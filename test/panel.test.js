import assert from "node:assert/strict";
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerPanel } from "../lib/panel.js";

test("the panel reads only registered projects and does not initialize a database", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "dsh-cam-"));
  const indexed = join(base, "indexed");
  const empty = join(base, "empty");
  const cam = join(indexed, ".cam");
  const db = join(cam, "cam.db");
  await mkdir(cam, { recursive: true });
  await writeFile(db, "");
  await mkdir(empty);
  t.after(async () => {
    await unlink(db);
    await rmdir(cam);
    await rmdir(indexed);
    await rmdir(empty);
    await rmdir(base);
  });

  let route;
  const contexts = [{ id: "one", path: indexed, title: "Indexed" }, { id: "two", path: empty, title: "Empty" }];
  const ctx = {
    effect() {},
    get: () => ({ list: () => contexts }),
    connection: { fetch: { register: (value) => { route = value; } } },
  };
  const calls = [];
  const call = async (args, options) => {
    calls.push({ args, path: options.path });
    return { refs: [] };
  };
  registerPanel(ctx, { call });
  const read = (params) => route.fetch(new Request(`http://localhost${route.path}?${new URLSearchParams(params)}`));

  assert.deepEqual(route.methods, ["GET", "POST"]);
  assert.deepEqual(await (await read({ action: "projects" })).json(), contexts);
  assert.equal((await read({ action: "memory", project: base })).status, 404);
  assert.equal((await (await read({ action: "memory", project: "two" })).json()).code, "noDatabase");
  assert.deepEqual(calls, []);

  const response = await read({ action: "refs", project: "one", value: "checkout.js:function:pay:1" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { incoming: { refs: [] }, outgoing: { refs: [] } });
  assert.deepEqual(calls, ["in", "out"].map((dir) => ({
    args: ["ref", "checkout.js:function:pay:1", "--dir", dir], path: indexed,
  })));
});

test("indexing requires POST and a registered project, and retries after a failed attempt", async () => {
  const project = { id: "one", path: join(tmpdir(), "dsh-cam-unindexed-demo"), title: "New project" };
  let route;
  const ctx = {
    effect() {},
    get: () => ({ list: () => [project] }),
    connection: { fetch: { register: (value) => { route = value; } } },
  };
  let fail;
  const attempts = [];
  registerPanel(ctx, {
    call: () => assert.fail("The index operation must not require a database lookup."),
    index: (args) => {
      attempts.push(args);
      if (attempts.length > 1) return { files: 1 };
      return new Promise((_, reject) => { fail = reject; });
    },
  });
  const request = (method, action = "index", id = project.id) => route.fetch(new Request(
    `http://localhost${route.path}?${new URLSearchParams({ action, project: id, force: "true" })}`, { method },
  ));

  const getIndex = await request("GET");
  assert.equal(getIndex.status, 405);
  assert.equal(getIndex.headers.get("allow"), "POST");
  assert.equal((await request("POST", "projects")).status, 405);
  assert.equal((await request("POST", "index", project.path)).status, 404);
  assert.deepEqual(attempts, []);

  const first = request("POST");
  const duplicate = await request("POST");
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, "indexRunning");
  fail(new Error("test index failure"));
  assert.equal((await first).status, 500);
  const retry = await request("POST");
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { files: 1 });
  assert.deepEqual(attempts, [{ path: project.path }, { path: project.path }]);
});
