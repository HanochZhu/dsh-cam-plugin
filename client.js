// The checked-in browser entry uses Harness's shared React and module loader.
// Git and npm installs can both serve it without a build step.
window.__ModuleLoader__.load({
  id: "dsh-cam-plugin",
  factory(require) {
    const { createElement: h, useEffect, useState } = require("react");
    const slot = "plugins.bundle.config";
    const locale = "dshCamPanel";
    const copy = {
      en: {
        title: "CAM explorer", project: "Project", refresh: "Refresh",
        memory: "Memory", graph: "Code graph", loading: "Loading…",
        filter: "Filter memory summaries", noMemory: "This project has no saved memories.",
        noMatches: "No matching entries.", selectMemory: "Select a memory to read it.",
        older: "Superseded", needsUpdate: "Needs update", related: "Related memories",
        search: "Find a symbol", searchButton: "Search", browse: "Browse files", root: "Project root",
        up: "Up one level", matches: "matches", noSymbols: "There are no indexed entries here.",
        selectSymbol: "Select a symbol to view its callers and callees.",
        callers: "Callers", selected: "Selected symbol", callees: "Callees",
        noRefs: "No indexed references.", ambiguous: "Choose the exact symbol.",
        noDatabase: "No CAM database in this project. Run cam index in its root to get started.",
        notIndexed: "The code graph is empty. Run cam index in this project's root.",
        error: "CAM data could not be loaded.", noProjects: "No project is available.",
      },
      zh: {
        title: "CAM 项目浏览", project: "项目", refresh: "刷新",
        memory: "记忆", graph: "代码图", loading: "正在加载…",
        filter: "筛选记忆摘要", noMemory: "这个项目还没有保存的记忆。",
        noMatches: "没有匹配的条目。", selectMemory: "选择一条记忆查看正文。",
        older: "已被替代", needsUpdate: "待更新", related: "关联记忆",
        search: "查找符号", searchButton: "搜索", browse: "浏览文件", root: "项目根目录",
        up: "上一级", matches: "条匹配", noSymbols: "此处没有已索引的条目。",
        selectSymbol: "选择一个符号，查看谁调用它，以及它调用了谁。",
        callers: "调用方", selected: "当前符号", callees: "被调用方",
        noRefs: "没有已索引的引用。", ambiguous: "请选择具体的同名符号。",
        noDatabase: "这个项目还没有 CAM 数据库。可在项目根目录运行 cam index 初始化。",
        notIndexed: "此项目尚未建立代码图。可在项目根目录运行 cam index。",
        error: "无法加载 CAM 数据。", noProjects: "没有可用的项目。",
      },
    };

    function useQuery(action, project, value, revision, keepPrevious = false) {
      const url = action && `api/dsh-cam-panel?${new URLSearchParams({ action, project, value })}`;
      const [result, setResult] = useState(null);
      useEffect(() => {
        if (!url) return;
        const controller = new AbortController();
        const { signal } = controller;
        fetch(url, { signal }).then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw Object.assign(new Error(json.message), { code: json.code });
          if (!signal.aborted) setResult({ url, revision, data: json });
        }).catch((error) => {
          if (!signal.aborted) setResult({ url, revision, error });
        });
        return () => controller.abort();
      }, [url, revision]);
      return url && result?.url === url && (keepPrevious || result.revision === revision) ? result : {};
    }

    function state(query, t, render) {
      if (query.error) {
        const { code, message } = query.error;
        if (code === "noDatabase" || code === "notIndexed") {
          return h("p", { role: "status", className: "cam-note" }, t(code));
        }
        return h("p", { role: "alert", className: "cam-note" }, t("error"), " ", message);
      }
      return query.data === undefined
        ? h("p", { role: "status", className: "cam-note" }, t("loading"))
        : render(query.data);
    }

    function memoryRows(nodes, filter, depth = 0) {
      return nodes.flatMap((node) => {
        const matches = node.summary.toLocaleLowerCase().includes(filter);
        const children = memoryRows(node.children, matches ? "" : filter, depth + 1);
        return matches || children.length ? [{ ...node, depth }, ...children] : [];
      });
    }

    function Memory({ project, revision, t }) {
      const [filter, setFilter] = useState("");
      const [id, setId] = useState("");
      const tree = useQuery("memory", project, "", revision);
      const detail = useQuery(id && "memoryDetail", project, id, revision);
      return state(tree, t, (nodes) => {
        if (nodes.length === 0) return h("p", { className: "cam-note" }, t("noMemory"));
        const rows = memoryRows(nodes, filter.trim().toLocaleLowerCase());
        return h("div", { className: "cam-content" },
          h("input", {
            type: "search", "aria-label": t("filter"), placeholder: t("filter"),
            value: filter, onChange: (event) => setFilter(event.target.value),
          }),
          h("div", { className: "cam-split" },
            h("ul", { className: "cam-list", "aria-label": t("memory") },
              rows.length === 0
                ? h("li", { className: "cam-note" }, t("noMatches"))
                : rows.map((node) => h("li", { key: node.id },
                  h("button", {
                    type: "button", className: "cam-row", "aria-pressed": node.id === id,
                    style: { paddingInlineStart: 10 + 12 * Math.min(node.depth, 8) },
                    onClick: () => setId(node.id),
                  }, node.summary))),
            ),
            h("div", { className: "cam-detail" }, id
              ? state(detail, t, (item) => h("article", null,
                h("h4", null, item.summary),
                (item.latest === false || item.needs_update) && h("p", { className: "cam-meta" },
                  [item.latest === false && t("older"), item.needs_update && t("needsUpdate")].filter(Boolean).join(" · ")),
                h("div", { className: "cam-memory-body" }, item.body),
                item.links?.length > 0 && h("div", { className: "cam-links" },
                  h("h5", null, t("related")),
                  item.links.map((link) => h("button", {
                    type: "button", key: link, onClick: () => setId(link),
                  }, link))),
              ))
              : h("p", { className: "cam-note" }, t("selectMemory"))),
          ),
        );
      });
    }

    function location(node) {
      const path = node.file_path ?? node.path;
      return path && node.start_line ? `${path}:${node.start_line}` : path;
    }

    function distinctRefs(refs) {
      return [...new Map(refs.map((ref) => [ref.id, ref])).values()];
    }

    function SymbolRow({ node, onSelect, selected }) {
      return h("button", {
        type: "button", className: "cam-row", onClick: () => onSelect(node),
        "aria-pressed": selected === undefined ? undefined : selected === (node.id ?? node.path),
      }, h("span", null, node.name), h("small", null, [node.kind, location(node)].filter(Boolean).join(" · ")));
    }

    function Neighborhood({ data, symbol, onSelect, t }) {
      const { incoming, outgoing } = data;
      const candidates = incoming.candidates ?? outgoing.candidates;
      if (candidates?.length) {
        return h("div", { className: "cam-detail" },
          h("p", { className: "cam-note" }, t("ambiguous")),
          candidates.map((node) => h(SymbolRow, { key: node.id, node, onSelect })),
        );
      }
      const focus = incoming.resolved ?? outgoing.resolved ?? symbol;
      const lane = (label, refs) => {
        const nodes = distinctRefs(refs ?? []);
        return h("div", { className: "cam-lane" },
          h("h5", null, `${t(label)} (${nodes.length})`),
          nodes.length
            ? h("ul", { className: "cam-ref-list" }, nodes.map((node) =>
              h("li", { key: node.id }, h(SymbolRow, { node, onSelect }))))
            : h("p", { className: "cam-note" }, t("noRefs")),
        );
      };
      return h("section", { className: "cam-neighborhood", "aria-label": t("graph") },
        lane("callers", incoming.refs),
        h("div", { className: "cam-focus" },
          h("h5", null, t("selected")), h("strong", null, focus.name),
          h("small", null, location(focus)),
        ),
        lane("callees", outgoing.refs),
      );
    }

    function Graph({ project, revision, t }) {
      const [input, setInput] = useState("");
      const [search, setSearch] = useState("");
      const [path, setPath] = useState("");
      const [symbol, setSymbol] = useState(null);
      const results = useQuery(search ? "search" : "browse", project, search || path, revision);
      const selected = symbol?.id ?? symbol?.path ?? "";
      const refs = useQuery(selected && "refs", project, selected, revision);
      return h("div", { className: "cam-content" },
        h("form", {
          className: "cam-bar",
          onSubmit: (event) => {
            event.preventDefault();
            setSearch(input.trim());
          },
        }, h("input", {
          type: "search", placeholder: t("search"), "aria-label": t("search"),
          value: input, onChange: (event) => setInput(event.target.value),
        }), h("button", { type: "submit" }, t("searchButton"))),
        h("div", { className: "cam-split" },
          h("section", { className: "cam-detail" },
            h("div", { className: "cam-bar cam-file-path" }, search
              ? h("button", { type: "button", onClick: () => { setSearch(""); setInput(""); } }, t("browse"))
              : h("span", null,
                path && h("button", {
                  type: "button", onClick: () => setPath(path.split("/").slice(0, -1).join("/")),
                }, t("up")),
                h("small", { title: path }, path || t("root")),
              )),
            state(results, t, (data) => {
              const rows = search ? data.hits : data;
              if (!rows.length) return h("p", { className: "cam-note" }, t(search ? "noMatches" : "noSymbols"));
              return h("div", null,
                search && h("p", { className: "cam-meta" }, `${rows.length} / ${data.total_matches} ${t("matches")}`),
                h("ul", { className: "cam-list cam-file-list" }, rows.map((node) => {
                  const folder = ["dir", "project", "file"].includes(node.kind);
                  return h("li", { key: node.id ?? `${node.path}:${node.start_line ?? ""}` },
                    h(SymbolRow, { node, selected: folder ? undefined : selected, onSelect: folder
                      ? () => setPath(node.path) : () => setSymbol(search ? node : { ...node, file_path: path }) }),
                  );
                })),
              );
            }),
          ),
          h("div", { className: "cam-detail", "aria-live": "polite" }, symbol
            ? state(refs, t, (data) => h(Neighborhood, { data, symbol, onSelect: setSymbol, t }))
            : h("p", { className: "cam-note" }, t("selectSymbol"))),
        ),
      );
    }

    function Panel({ t }) {
      const [project, setProject] = useState("");
      const [view, setView] = useState("memory");
      const [revision, setRevision] = useState(0);
      const listing = useQuery("projects", "", "", revision, true);
      return h("section", { "data-cam-panel": "", "aria-label": t("title") },
        h("header", { className: "cam-bar cam-header" },
          h("h3", null, t("title")),
          h("button", { type: "button", onClick: () => setRevision((value) => value + 1) }, t("refresh")),
        ),
        state(listing, t, (projects) => {
          const active = projects.find(({ id }) => id === project) ?? projects[0];
          if (!active) return h("p", { className: "cam-note" }, t("noProjects"));
          return h("div", null,
            h("label", { className: "cam-project" },
              h("span", null, t("project")),
              h("select", { value: active.id, onChange: (event) => setProject(event.target.value) },
                projects.map(({ id, title, path }) => h("option", {
                  key: id, value: id,
                }, `${title} — ${path}`))),
            ),
            h("div", { className: "cam-switch", role: "group", "aria-label": t("title") },
              ["memory", "graph"].map((tab) => h("button", {
                type: "button", key: tab, "aria-pressed": view === tab, onClick: () => setView(tab),
              }, t(tab))),
            ),
            h(view === "memory" ? Memory : Graph, { key: active.id, project: active.id, revision, t }),
          );
        }),
      );
    }

    const css = `
      [data-cam-panel] {
        --cam-line: var(--dsw-alias-border-l2, #dbe2ef);
        --cam-surface: var(--dsw-alias-bg-layer-1, #fff);
        --cam-muted: var(--dsw-alias-label-secondary, #556274);
        --cam-accent: var(--dsw-alias-brand-primary, #3665cc);
        --cam-hover: var(--dsw-alias-interactive-bg-hover, #eef2fa);
        container-type: inline-size;
        min-width: 0;
        padding: 16px;
        border: 1px solid var(--cam-line);
        border-radius: 12px;
        background: var(--cam-surface);
        color: var(--dsw-alias-label-primary, #192433);
        font-size: 13px;
      }
      [data-cam-panel] button, [data-cam-panel] input, [data-cam-panel] select {
        box-sizing: border-box;
        min-width: 0;
        color: inherit;
        font: inherit;
        border: 1px solid var(--cam-line);
        border-radius: 7px;
        padding: 6px 10px;
        background: var(--cam-surface);
      }
      [data-cam-panel] button { cursor: pointer; }
      [data-cam-panel] button:hover { background: var(--cam-hover); }
      [data-cam-panel] :is(button, input, select):focus-visible {
        outline: 2px solid var(--cam-accent); outline-offset: -2px;
      }
      [data-cam-panel] button[aria-pressed="true"] {
        background: color-mix(in srgb, var(--cam-accent) 11%, var(--cam-surface));
        color: var(--cam-accent);
        border-color: color-mix(in srgb, var(--cam-accent) 35%, var(--cam-line));
      }
      [data-cam-panel] h3 { margin: 0; font-size: 16px; font-weight: 650; }
      [data-cam-panel] h4 { margin: 0 0 10px; font-size: 15px; }
      [data-cam-panel] h5 { margin: 0 0 6px; font-size: 12px; color: var(--cam-muted); }
      [data-cam-panel] .cam-header { justify-content: space-between; margin-bottom: 12px; }
      [data-cam-panel] .cam-bar, [data-cam-panel] .cam-project {
        display: flex; align-items: center; gap: 8px; min-width: 0;
      }
      [data-cam-panel] .cam-project select, [data-cam-panel] input { flex: 1; width: 100%; }
      [data-cam-panel] .cam-switch { display: flex; gap: 6px; margin: 12px 0; }
      [data-cam-panel] .cam-content { display: grid; gap: 10px; }
      [data-cam-panel] .cam-split {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 10px;
        align-items: start;
      }
      [data-cam-panel] :is(.cam-list, .cam-ref-list) {
        margin: 0; padding: 4px; list-style: none; max-height: 320px; overflow: auto;
      }
      [data-cam-panel] :is(.cam-list, .cam-detail) {
        min-width: 0; border: 1px solid var(--cam-line); border-radius: 8px;
      }
      [data-cam-panel] .cam-detail { padding: 10px; overflow-wrap: anywhere; }
      [data-cam-panel] .cam-file-list { padding: 0; border: 0; }
      [data-cam-panel] .cam-row {
        display: grid; gap: 2px; width: 100%; text-align: start; overflow-wrap: anywhere;
        border-color: transparent; background: transparent;
      }
      [data-cam-panel] :is(small, .cam-note, .cam-meta) { color: var(--cam-muted); }
      [data-cam-panel] .cam-note { margin: 0; padding: 7px 4px; }
      [data-cam-panel] .cam-meta { margin: 4px 0; font-size: 12px; }
      [data-cam-panel] .cam-file-path { margin-bottom: 5px; }
      [data-cam-panel] .cam-file-path button { margin-inline-end: 6px; }
      [data-cam-panel] .cam-memory-body { white-space: pre-wrap; line-height: 1.55; }
      [data-cam-panel] .cam-links { margin-top: 12px; }
      [data-cam-panel] .cam-links button { margin: 0 5px 5px 0; }
      [data-cam-panel] .cam-neighborhood {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .85fr) minmax(0, 1fr);
        gap: 14px; align-items: center;
      }
      [data-cam-panel] :is(.cam-lane, .cam-focus) {
        min-width: 0; padding: 7px; border: 1px solid var(--cam-line); border-radius: 8px;
      }
      [data-cam-panel] .cam-focus {
        position: relative; display: grid; gap: 3px; border-color: var(--cam-accent);
      }
      [data-cam-panel] .cam-focus::before, [data-cam-panel] .cam-focus::after {
        content: "→"; color: var(--cam-accent); position: absolute; top: 50%; translate: 0 -50%;
      }
      [data-cam-panel] .cam-focus::before { right: calc(100% + 2px); }
      [data-cam-panel] .cam-focus::after { left: calc(100% + 2px); }
      [data-cam-panel] .cam-ref-list { padding: 0; max-height: 225px; }
      @container (max-width: 680px) {
        [data-cam-panel] .cam-split { grid-template-columns: minmax(0, 1fr); }
        [data-cam-panel] .cam-list { max-height: 170px; }
      }
      @container (max-width: 420px) {
        [data-cam-panel] .cam-neighborhood { grid-template-columns: minmax(0, 1fr); gap: 8px; }
        [data-cam-panel] .cam-focus::before, [data-cam-panel] .cam-focus::after { content: none; }
      }
    `;

    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(locale, copy));
        ctx.effect(() => {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.append(style);
          return () => style.remove();
        });
        ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, key: "dsh-cam-plugin", locale }, Panel));
      },
    };
  },
});
