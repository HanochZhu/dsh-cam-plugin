import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseSkill } from "../lib/skill.js";
import {
  addCommand,
  findCommand,
  grepCommand,
  indexCommand,
  lsCommand,
  memShowCommand,
  readCommand,
  recallCommand,
  refCommand,
  withProject,
} from "../lib/commands.js";

test("recall builds an English query and optional flags", () => {
  assert.deepEqual(recallCommand({ query: "how recall fuses rankings", limit: 5, snippets: true }), [
    "recall",
    "how recall fuses rankings",
    "--limit",
    "5",
    "--snippets",
  ]);
  assert.deepEqual(
    recallCommand({ query: "older decision", includeSuperseded: true, noExpand: true }),
    ["recall", "older decision", "--no-expand", "--include-superseded"],
  );
});

test("a leading dash is passed as a positional", () => {
  assert.deepEqual(recallCommand({ query: "-n" }), ["recall", "--", "-n"]);
  assert.deepEqual(findCommand({ query: "-", limit: 40 }), ["find", "--limit", "40", "--", "-"]);
  assert.deepEqual(refCommand({ symbol: "-sample.js", dir: "out" }), ["ref", "--dir", "out", "--", "-sample.js"]);
});

test("index force is explicit", () => {
  assert.deepEqual(indexCommand({}), ["index"]);
  assert.deepEqual(indexCommand({ force: true }), ["index", "--force"]);
});

test("ls, find, grep, and read map optional filters", () => {
  assert.deepEqual(lsCommand({}), ["ls"]);
  assert.deepEqual(lsCommand({ virtPath: "src/main.rs" }), ["ls", "src/main.rs"]);
  assert.deepEqual(findCommand({ query: "recall", kind: "function", file: "memory", scope: "src", limit: 3 }), [
    "find",
    "recall",
    "--kind",
    "function",
    "--file",
    "memory",
    "--scope",
    "src",
    "--limit",
    "3",
  ]);
  assert.deepEqual(grepCommand({ query: "reciprocal", scope: "src/memory", limit: 2 }), [
    "grep",
    "reciprocal",
    "--scope",
    "src/memory",
    "--limit",
    "2",
  ]);
  assert.deepEqual(readCommand({ virtPath: "src/main.rs/main", full: true }), [
    "read",
    "src/main.rs/main",
    "--full",
  ]);
});

test("ref requires a direction", () => {
  assert.deepEqual(refCommand({ symbol: "add_rrf_ranks", dir: "in", file: "fuse.rs" }), [
    "ref",
    "add_rrf_ranks",
    "--dir",
    "in",
    "--file",
    "fuse.rs",
  ]);
  assert.throws(() => refCommand({ symbol: "add_rrf_ranks", dir: "both" }), /dir must be in or out/);
});

test("add puts the summary in one argv and leaves the body for stdin", () => {
  assert.deepEqual(
    addCommand({
      summary: "Hybrid recall uses reciprocal rank fusion",
      body: "ignored here",
      parent: "mem_a",
      supersedes: "mem_b",
      links: ["mem_c", " mem_d "],
    }),
    [
      "add",
      "--summary=Hybrid recall uses reciprocal rank fusion",
      "--parent=mem_a",
      "--supersedes=mem_b",
      "--link",
      "mem_c",
      "--link",
      "mem_d",
    ],
  );
});

test("project is a global flag before the subcommand", () => {
  assert.deepEqual(withProject(memShowCommand({ id: "mem_1" }), "D:/work/app"), [
    "--json",
    "--project",
    "D:/work/app",
    "mem",
    "show",
    "mem_1",
  ]);
  assert.deepEqual(withProject(["status"], undefined), ["--json", "status"]);
});

test("empty required text and a bad limit fail before spawn", () => {
  assert.throws(() => recallCommand({ query: "  " }), /query is required/);
  assert.throws(() => findCommand({ query: "a", limit: 0 }), /limit must be an integer/);
  assert.throws(() => addCommand({ summary: "", links: [""] }), /summary is required/);
});

test("the skill names every registered tool", () => {
  const index = readFileSync(new URL("../index.js", import.meta.url), "utf8");
  const skill = readFileSync(new URL("../skills/cam/SKILL.md", import.meta.url), "utf8");
  const names = [...index.matchAll(/name: "(cam_[a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, [
    "cam_recall",
    "cam_index",
    "cam_ls",
    "cam_find",
    "cam_grep",
    "cam_read",
    "cam_ref",
    "cam_add",
    "cam_mem_show",
    "cam_mem_tree",
    "cam_status",
  ]);
  for (const toolName of names) {
    assert.match(skill, new RegExp(toolName));
  }
  const parsed = parseSkill(skill);
  assert.match(parsed.description, /^Query the local cam code graph/);
  assert.match(parsed.content, /cam_recall/);
  assert.doesNotMatch(parsed.content, /^---/);
});
