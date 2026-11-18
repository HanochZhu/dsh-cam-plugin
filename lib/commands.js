function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value;
}

function optionalLimit(limit) {
  if (limit == null) return;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be an integer >= 1");
  }
}

function positional(value) {
  return value.startsWith("-") ? ["--", value] : [value];
}

export function withProject(commandArgs, project) {
  const args = ["--json"];
  if (project) args.push("--project", project);
  args.push(...commandArgs);
  return args;
}

export function recallCommand(args) {
  const query = requiredText(args.query, "query");
  optionalLimit(args.limit);
  const cmd = ["recall", ...positional(query)];
  if (args.limit != null) cmd.push("--limit", String(args.limit));
  if (args.noExpand) cmd.push("--no-expand");
  if (args.includeSuperseded) cmd.push("--include-superseded");
  if (args.snippets) cmd.push("--snippets");
  return cmd;
}

export function indexCommand(args) {
  return args.force ? ["index", "--force"] : ["index"];
}

export function lsCommand(args) {
  const cmd = ["ls"];
  if (args.virtPath?.trim()) cmd.push(...positional(args.virtPath));
  return cmd;
}

export function findCommand(args) {
  const query = requiredText(args.query, "query");
  optionalLimit(args.limit);
  const cmd = ["find", ...positional(query)];
  if (args.kind) cmd.push("--kind", args.kind);
  if (args.file) cmd.push("--file", args.file);
  if (args.scope) cmd.push("--scope", args.scope);
  if (args.limit != null) cmd.push("--limit", String(args.limit));
  return cmd;
}

export function grepCommand(args) {
  const query = requiredText(args.query, "query");
  optionalLimit(args.limit);
  const cmd = ["grep", ...positional(query)];
  if (args.scope) cmd.push("--scope", args.scope);
  if (args.limit != null) cmd.push("--limit", String(args.limit));
  return cmd;
}

export function readCommand(args) {
  const virtPath = requiredText(args.virtPath, "virtPath");
  const cmd = ["read", ...positional(virtPath)];
  if (args.full) cmd.push("--full");
  return cmd;
}

export function refCommand(args) {
  const symbol = requiredText(args.symbol, "symbol");
  if (args.dir !== "in" && args.dir !== "out") {
    throw new Error("dir must be in or out");
  }
  const cmd = ["ref", ...positional(symbol), "--dir", args.dir];
  if (args.file) cmd.push("--file", args.file);
  if (args.kind) cmd.push("--kind", args.kind);
  if (args.scope) cmd.push("--scope", args.scope);
  return cmd;
}

export function addCommand(args) {
  const summary = requiredText(args.summary, "summary");
  const cmd = ["add", `--summary=${summary}`];
  if (args.parent?.trim()) cmd.push(`--parent=${args.parent.trim()}`);
  if (args.supersedes?.trim()) cmd.push(`--supersedes=${args.supersedes.trim()}`);
  for (const id of args.links ?? []) {
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("links entries must be non-empty strings");
    }
    cmd.push("--link", id.trim());
  }
  return cmd;
}

export function memShowCommand(args) {
  return ["mem", "show", ...positional(requiredText(args.id, "id"))];
}

export function memTreeCommand() {
  return ["mem", "tree"];
}

export function statusCommand() {
  return ["status"];
}
