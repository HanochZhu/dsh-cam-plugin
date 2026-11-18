import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { present } from "../lib/present.js";
import { runProcess } from "../lib/run.js";

const node = process.execPath;
const ok = fileURLToPath(new URL("../fixtures/ok.js", import.meta.url));
const fail = fileURLToPath(new URL("../fixtures/fail.js", import.meta.url));

test("present keeps short JSON and clips the tail", () => {
  assert.equal(present({ ok: true }, 80), '{\n  "ok": true\n}');
  const clipped = present({ text: "x".repeat(50) }, 20);
  assert.match(clipped, /truncated \d+ characters/);
  assert.equal(clipped.length > 20, true);
});

test("runProcess returns JSON from a successful process", async () => {
  const payload = await runProcess(node, [ok], { stdin: "hello", timeoutMs: 5_000 });
  assert.equal(payload.stdin, "hello");
  assert.deepEqual(payload.argv, []);
});

test("runProcess surfaces a cam error object", async () => {
  await assert.rejects(runProcess(node, [fail], { timeoutMs: 5_000 }), /not_indexed: graph is not indexed/);
});

test("runProcess rejects a missing binary", async () => {
  await assert.rejects(runProcess("cam-not-installed-xyz", ["--json"], { timeoutMs: 5_000 }), /cam binary not found/);
});

test("runProcess propagates an aborted signal as AbortError", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runProcess(node, ["-e", "setTimeout(() => {}, 30000)"], { signal: controller.signal, timeoutMs: 5_000 }),
    (error) => error instanceof Error && error.name === "AbortError",
  );
});
