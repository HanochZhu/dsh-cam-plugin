/**
 * DeepSeek Harness plugin for the local cam code graph and solution memory.
 *
 * A Cordis plugin exports `name` and `apply(ctx, config)`. `inject` waits until
 * the tool registry exists. Registered tools are removed when the plugin unloads.
 * The host supplies `@deepseek-ai/dsh-tools`; this package does not bundle it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { parseSkill } from "./lib/skill.js";
import {
  addCommand,
  findCommand,
  grepCommand,
  indexCommand,
  lsCommand,
  memShowCommand,
  memTreeCommand,
  readCommand,
  recallCommand,
  refCommand,
  statusCommand,
  withProject,
} from "./lib/commands.js";
import { present } from "./lib/present.js";
import { runProcess } from "./lib/run.js";

export const name = "cam";
export const inject = ["tools"];

const textOutput = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }],
};

const pathParam = {
  path: {
    type: "string",
    description:
      "Project root. Defaults to plugin config.project, then CAM_PROJECT, then cam walks up from the process cwd for .cam or .git.",
  },
};

const INDEX_TIMEOUT_MS = 600_000;
const EMBED_TIMEOUT_MS = 180_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function loadSkill() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "skills", "cam", "SKILL.md");
  return parseSkill(readFileSync(file, "utf8"));
}

export function apply(ctx, config = {}) {
  const bin = (config.camBin || process.env.CAM_BIN || "cam").trim() || "cam";
  const defaultProject = (config.project || process.env.CAM_PROJECT || "").trim() || undefined;

  const call = (commandArgs, { path, timeoutMs, signal, stdin } = {}) => {
    const project = (typeof path === "string" ? path.trim() : "") || defaultProject;
    return runProcess(bin, withProject(commandArgs, project), {
      cwd: project,
      timeoutMs,
      signal,
      stdin,
    });
  };

  const register = (def) => {
    ctx.tools.register(
      defineTool({
        name: def.name,
        description: def.description,
        parameters: def.parameters,
        output: textOutput,
        async execute(args, exec) {
          const payload = await def.run(args, exec?.signal);
          return present(payload);
        },
      }),
    );
  };

  register({
    name: "cam_recall",
    description:
      "Search project memory. Translate the question into one English sentence first. Reuse a hit only when it is latest and not needs_update. On body_truncated, call cam_mem_show before using the details.",
    parameters: {
      query: { type: "string", required: true, description: "One English sentence." },
      limit: { type: "integer", description: "Maximum hits. cam default is 3." },
      snippets: {
        type: "boolean",
        description: "Clip long lower-ranked bodies. Read a clipped hit with cam_mem_show.",
      },
      includeSuperseded: { type: "boolean", description: "Include older revisions that have been superseded." },
      noExpand: { type: "boolean", description: "Return the raw fused list without pulling in the newest revision." },
      ...pathParam,
    },
    run: (args, signal) =>
      call(recallCommand(args), { path: args.path, timeoutMs: EMBED_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_index",
    description:
      "Build or update the code graph in .cam/cam.db. Incremental unless force is true. Call once when another cam tool reports not_indexed. Do not pass force for ordinary edits.",
    parameters: {
      force: { type: "boolean", description: "Rebuild every file even when the graph already exists." },
      ...pathParam,
    },
    run: (args, signal) => call(indexCommand(args), { path: args.path, timeoutMs: INDEX_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_ls",
    description:
      "List the indexed graph as a virtual filesystem. A nested git checkout is kind project; pass that path as scope to cam_ref or cam_find.",
    parameters: {
      virtPath: { type: "string", description: "Virtual path such as src/ or src/main.rs. Omit for the repo root." },
      ...pathParam,
    },
    run: (args, signal) => call(lsCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_find",
    description:
      "Find symbols whose name contains a substring. Exact names rank first. Matches names only, not text inside bodies. Use cam_grep for literal text.",
    parameters: {
      query: { type: "string", required: true, description: "Part of a symbol name." },
      kind: { type: "string", description: "function, method, struct, class, trait, enum, enum_variant, or type_alias." },
      file: { type: "string", description: "Keep symbols whose file path contains this substring." },
      scope: { type: "string", description: "Keep symbols under this directory, typically a project entry from cam_ls." },
      limit: { type: "integer", description: "Maximum hits. Default 20." },
      ...pathParam,
    },
    run: (args, signal) => call(findCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_grep",
    description: "Search literal text in indexed source files. This does not match symbol names; use cam_find for that.",
    parameters: {
      query: { type: "string", required: true, description: "Literal text." },
      scope: { type: "string", description: "Restrict to this project-relative directory." },
      limit: { type: "integer", description: "Maximum hits. Default 20." },
      ...pathParam,
    },
    run: (args, signal) => call(grepCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_read",
    description:
      "Read a file outline or one symbol body. Prefer a symbol path such as src/main.rs/main over the whole file. On status ambiguous, pass a candidate id.",
    parameters: {
      virtPath: {
        type: "string",
        required: true,
        description: "Virtual path (src/main.rs or src/main.rs/main) or a node id from an ambiguous answer.",
      },
      full: { type: "boolean", description: "Read the whole file. Prefer the default outline or symbol body." },
      ...pathParam,
    },
    run: (args, signal) => call(readCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_ref",
    description:
      "List one-hop callers (dir in) or callees (dir out). On status ambiguous, retry with a candidate id, or pass file, kind, or scope.",
    parameters: {
      symbol: { type: "string", required: true, description: "Symbol name, virtual path, or node id." },
      dir: { type: "string", required: true, enum: ["in", "out"], description: "in = callers, out = callees." },
      file: { type: "string", description: "Case-insensitive substring of the defining file path." },
      kind: { type: "string", description: "Node kind, such as function or method." },
      scope: { type: "string", description: "Sub-directory, typically a project entry from cam_ls." },
      ...pathParam,
    },
    run: (args, signal) => call(refCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_add",
    description:
      "Store one memory: one fact, or the solution path for one problem (symptom, cause, change, and how to verify). summary is one English line. If two pieces can be asked about separately, call cam_add twice and pass the first id in links. The body is sent on stdin.",
    parameters: {
      summary: { type: "string", required: true, description: "One English line." },
      body: { type: "string", required: true, description: "Detail this one fact needs. Other languages are allowed." },
      parent: { type: "string", description: "Structural parent memory id." },
      supersedes: { type: "string", description: "Older revision this memory fully replaces." },
      links: {
        type: "array",
        items: { type: "string" },
        description: "Related memory ids. Recall does not walk links.",
      },
      ...pathParam,
    },
    run: (args, signal) => {
      if (typeof args.body !== "string" || args.body.trim() === "") {
        throw new Error("body is required");
      }
      return call(addCommand(args), {
        path: args.path,
        timeoutMs: EMBED_TIMEOUT_MS,
        signal,
        stdin: args.body,
      });
    },
  });

  register({
    name: "cam_mem_show",
    description: "Show one memory by id, including a body that cam_recall clipped.",
    parameters: {
      id: { type: "string", required: true, description: "Memory id from cam_recall or cam_mem_tree." },
      ...pathParam,
    },
    run: (args, signal) => call(memShowCommand(args), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_mem_tree",
    description: "Print the solution memory tree.",
    parameters: { ...pathParam },
    run: (args, signal) => call(memTreeCommand(), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  register({
    name: "cam_status",
    description: "Show the resolved project, database path, and whether the code graph exists.",
    parameters: { ...pathParam },
    run: (args, signal) => call(statusCommand(), { path: args.path, timeoutMs: DEFAULT_TIMEOUT_MS, signal }),
  });

  const skills = ctx.get?.("skills");
  if (skills?.register) {
    const skill = loadSkill();
    skills.register({
      name: "cam",
      description: skill.description,
      content: skill.content,
      source: "runtime",
      provider: "dsh-cam-plugin",
    });
  }
}
