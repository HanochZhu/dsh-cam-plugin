process.stdout.write(
  JSON.stringify({ error: { code: "not_indexed", message: "graph is not indexed" } }),
);
process.exit(1);
