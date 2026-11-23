import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { findCommand, lsCommand, memShowCommand, memTreeCommand, refCommand } from "./commands.js";

const ROUTE = "/api/dsh-cam-panel";
const SEARCH_LIMIT = 40;

function projects(ctx, defaultProject) {
  const choices = new Map();
  if (defaultProject) {
    const path = resolve(defaultProject);
    choices.set(path, { id: "configured", path, title: basename(path) || path });
  }
  for (const workspace of ctx.get("workspaceRegistry")?.list() ?? []) {
    if (!choices.has(workspace.path)) {
      choices.set(workspace.path, { id: workspace.id, path: workspace.path, title: workspace.title });
    }
  }
  if (choices.size === 0) {
    const path = process.cwd();
    choices.set(path, { id: "cwd", path, title: basename(path) || path });
  }
  return [...choices.values()];
}

function reply(value, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

async function hasDatabase(path) {
  try {
    return (await stat(join(path, ".cam", "cam.db"))).isFile();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

export function registerPanel(ctx, call, defaultProject) {
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  ctx.connection.fetch.register({
    path: ROUTE,
    methods: ["GET"],
    requestBody: "buffered",
    async fetch(request) {
      const params = new URL(request.url).searchParams;
      const action = params.get("action");
      const choices = projects(ctx, defaultProject);
      if (action === "projects") return reply(choices);
      const project = choices.find(({ id }) => id === params.get("project"));
      if (!project) return reply({ code: "project", message: "Unknown CAM project." }, 404);

      const value = params.get("value") ?? "";
      if (value.length > 4096 || value.includes("\0")
        || (["memoryDetail", "search", "refs"].includes(action) && !value.trim())) {
        return reply({ code: "input", message: "Invalid CAM lookup." }, 400);
      }

      const signal = AbortSignal.any([request.signal, lifetime.signal]);
      const run = (args) => call(args, { path: project.path, timeoutMs: 30_000, signal });
      try {
        signal.throwIfAborted();
        if (!(await hasDatabase(project.path))) {
          return reply({ code: "noDatabase", message: "CAM database not found." }, 404);
        }
        signal.throwIfAborted();
        switch (action) {
          case "memory": return reply(await run(memTreeCommand()));
          case "memoryDetail": return reply(await run(memShowCommand({ id: value })));
          case "browse": return reply(await run(lsCommand({ virtPath: value })));
          case "search": return reply(await run(findCommand({ query: value, limit: SEARCH_LIMIT })));
          case "refs": {
            const [incoming, outgoing] = await Promise.all([
              run(refCommand({ symbol: value, dir: "in" })),
              run(refCommand({ symbol: value, dir: "out" })),
            ]);
            return reply({ incoming, outgoing });
          }
          default: return reply({ code: "input", message: "Unknown CAM lookup." }, 400);
        }
      } catch (error) {
        if (signal.aborted) return reply({ code: "cancelled", message: "CAM lookup cancelled." }, 499);
        if (error.message.startsWith("not_indexed:")) {
          return reply({ code: "notIndexed", message: error.message }, 409);
        }
        return reply({ code: "cam", message: error.message }, 500);
      }
    },
  });
}
