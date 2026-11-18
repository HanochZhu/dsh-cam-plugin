---
name: cam
description: "Query the local cam code graph and project memory. Use when a problem may have been solved before, when you need callers or callees, when you should read a symbol instead of a whole file, or when a settled project fact should be saved."
---

# cam

`cam` keeps a code graph and solution memory in `.cam/cam.db` inside the project. It is local SQLite. These tools do not send project data anywhere. The `cam` binary must already be on PATH.

## Steps

1. Recall first. Turn the question into one English sentence, then call `cam_recall`.
   - Reuse a hit only when it is `latest` and not `needs_update`.
   - A hit carries its body. When the result says `body_truncated`, call `cam_mem_show` with that id before using the details.
   - On `stale`, `needs_update`, or no hit, continue.
2. If `cam_ls`, `cam_find`, `cam_read`, or `cam_ref` returns `not_indexed`, call `cam_index` once. Later calls apply only changes. Do not pass `force` for ordinary edits. `cam_status` shows whether a graph already exists.
3. Walk the graph: `cam_find` or `cam_ls`, then `cam_read` on a virtual path, then `cam_ref`.
   - `cam_find` matches symbol names only. `cam_grep` searches literal text in indexed files.
   - `src/main.rs` is a file. `src/main.rs/main` is a symbol in that file.
   - `cam_ref` `dir: in` lists callers. `dir: out` lists callees.
   - On `status: ambiguous`, retry with a candidate `id`, or pass `file`, `kind`, or `scope`.
4. After a new fact is settled, store one memory with `cam_add`: one fact, or the solution path for one problem (symptom, cause, change, and how to verify). If two pieces can be asked about separately, or can become outdated separately, store two memories and pass the first id in `links`. `summary` is one English line. The body may use other languages. `parent` is hierarchy. `supersedes` only when this memory fully replaces an older one. `cam_mem_tree` shows the tree.

Pass `path` when the project root is not the process working directory. One `cam_add` stores one memory; the CLI has no multi-memory array.

## Output

Report in this order:

1. Memory: hit id and whether it was reused, or `no usable memory`.
2. Code: virtual paths read, and whether each `cam_ref` was callers (`in`) or callees (`out`).
3. Write-back: new memory id, or `nothing new to store`.

Quote the symbol body cam returned. Do not paste whole files.
