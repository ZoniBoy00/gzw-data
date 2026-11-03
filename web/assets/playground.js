// Playground: build a request, run it against the live API, and mirror it as cURL, JavaScript and Python.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = "/api/v1";
  const ORIGIN = "https://gzw-data.dev/api/v1";
  const pg = $("[data-playground]");
  if (!pg) return;

  const datasetPath = { name: "dataset", label: "Dataset", value: "weapons", list: "pg-datasets", in: "path" };
  const ENDPOINTS = {
    list: {
      label: "List a dataset",
      path: (v) => v.dataset,
      fields: [datasetPath, { name: "page", label: "Page", value: "1", type: "number" }, { name: "per_page", label: "Per page", value: "5", type: "number" }, { name: "search", label: "Search (optional)", value: "" }],
    },
    record: {
      label: "Get one record",
      path: (v) => `${v.dataset}/${encodeURIComponent(v.id)}`,
      fields: [datasetPath, { name: "id", label: "Record ID", value: "ak-12", in: "path" }],
    },
    search: {
      label: "Search across datasets",
      path: () => "search",
      fields: [{ name: "q", label: "Query", value: "AK" }, { name: "dataset", label: "Dataset (optional)", value: "weapons", list: "pg-datasets" }, { name: "limit", label: "Limit", value: "5", type: "number" }],
    },
    metadata: { label: "Dataset metadata", path: (v) => `metadata/${v.dataset}`, fields: [datasetPath] },
    stats: { label: "Dataset statistics", path: () => "stats", fields: [] },
    version: { label: "API and data version", path: () => "version", fields: [] },
    health: { label: "API health", path: () => "health", fields: [] },
  };

  const select = $("select", pg), fieldsBox = $("[data-pg-fields]", pg), urlEl = $("[data-pg-url]", pg);
  const meta = $("[data-pg-meta]", pg), body = $("[data-pg-body]", pg);
  const snippets = $$("pre code", $("[data-pg-snippets]"));
  Object.entries(ENDPOINTS).forEach(([key, e]) => select.append(new Option(e.label, key)));

  const build = () => {
    const endpoint = ENDPOINTS[select.value];
    const values = Object.fromEntries($$("input", fieldsBox).map((i) => [i.name, i.value.trim()]));
    const params = new URLSearchParams();
    endpoint.fields.forEach((f) => { if (f.in !== "path" && values[f.name]) params.set(f.name, values[f.name]); });
    const query = params.toString();
    return `${endpoint.path(values)}${query ? `?${query}` : ""}`;
  };

  const refresh = () => {
    const url = `${ORIGIN}/${build()}`;
    urlEl.textContent = url;
    snippets[0].textContent = `curl "${url}"`;
    snippets[1].textContent = `const res = await fetch("${url}");\nconst { data } = await res.json();`;
    snippets[2].textContent = `import requests\n\ndata = requests.get("${url}").json()["data"]`;
  };

  const run = async () => {
    const path = build();
    meta.classList.remove("bad");
    meta.textContent = "Running request…";
    body.classList.remove("loaded");
    const started = performance.now();
    try {
      const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json" } });
      const text = await res.text();
      const ms = Math.round(performance.now() - started);
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }
      body.textContent = pretty;
      const kb = (new Blob([text]).size / 1024).toFixed(1);
      meta.textContent = `${res.status} ${res.ok ? "OK" : "Error"}, ${ms} ms, ${kb} KB${res.status === 429 ? ". Rate limited: wait for the Retry-After delay." : ""}`;
      meta.classList.toggle("bad", !res.ok);
    } catch (err) {
      body.textContent = "";
      meta.textContent = `Request failed: ${err.message}. Check your connection and try again.`;
      meta.classList.add("bad");
    }
    void body.offsetWidth;
    body.classList.add("loaded");
  };

  const renderFields = () => {
    fieldsBox.textContent = "";
    ENDPOINTS[select.value].fields.forEach((f) => {
      const id = `pg-f-${f.name}`;
      const label = document.createElement("label");
      label.htmlFor = id; label.textContent = f.label;
      const input = document.createElement("input");
      Object.assign(input, { id, name: f.name, value: f.value, type: f.type === "number" ? "number" : "text", autocomplete: "off", spellcheck: false });
      if (f.type === "number") input.min = "1";
      if (f.list) input.setAttribute("list", f.list);
      input.addEventListener("input", refresh);
      fieldsBox.append(label, input);
    });
    refresh();
  };

  select.addEventListener("change", renderFields);
  $("[data-pg-run]", pg).addEventListener("click", run);
  $("form", pg).addEventListener("submit", (ev) => { ev.preventDefault(); run(); });
  $("[data-pg-copy]", pg).addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    try { await navigator.clipboard.writeText(urlEl.textContent); btn.textContent = "Copied"; } catch { btn.textContent = "Press Ctrl+C"; }
    setTimeout(() => { btn.textContent = "Copy URL"; }, 1500);
  });

  fetch(`${API}/stats`).then((r) => r.json()).then(({ data }) => {
    const list = $("#pg-datasets");
    Object.keys(data).sort().forEach((name) => list.append(new Option(name)));
  }).catch(() => { /* typing a dataset name still works */ });

  renderFields();
})();
