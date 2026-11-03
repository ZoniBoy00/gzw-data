// Dataset reference page: one shared template served for /datasets/{name}/, filled from the live metadata endpoint
// so a dataset the scraper just discovered has a documented page without a site rebuild.
(() => {
  const root = document.querySelector("[data-dataset-page]");
  if (!root) return;
  const $ = (s, r = root) => r.querySelector(s);
  const API = "/api/v1";
  const fmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const codeCell = (text) => { const td = document.createElement("td"); td.append(el("code", text)); return td; };
  const clip = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  const name = decodeURIComponent(location.pathname.split("/").filter(Boolean)[1] || "");
  const lead = $("[data-ds-lead]");
  const fail = (text) => {
    lead.hidden = true;
    $("[data-ds-error-text]").textContent = text;
    $("[data-ds-error]").hidden = false;
  };
  if (!/^[\w.-]+$/.test(name)) { fail("That is not a valid dataset name."); return; }

  document.title = `${name} · Datasets · GZW Data`;
  const h1 = document.querySelector(".doc h1");
  if (h1) h1.textContent = name;
  const crumb = document.querySelector(".crumbs span:last-child");
  if (crumb) crumb.textContent = name;

  const typeOf = (f) => [...f.types, ...(f.nullable ? ["null"] : [])].join(" | ");
  const stringify = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));

  fetch(`${API}/metadata/${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) { fail(`There is no dataset called “${name}”. It may have been renamed or removed.`); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = body.data;
      const total = meta.itemCount;
      const fields = Object.entries(meta.fields || {});
      const path = encodeURIComponent(name);
      const base = `${location.origin}${API}`;

      lead.textContent = `${fmt(total)} records with ${fmt(fields.length)} observed fields. Everything on this page is generated from the live API.`;
      $('[data-ds-kv="records"]').textContent = fmt(total);
      $('[data-ds-kv="fields"]').textContent = fmt(fields.length);
      $('[data-ds-kv="scraped"]').textContent = meta.lastScrapedAt
        ? `${new Date(meta.lastScrapedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "unknown";
      $('[data-ds-kv="file"]').textContent = meta.file || `${name}.json`;

      const idExample = meta.fields?.id?.example;
      const exampleId = idExample != null ? encodeURIComponent(String(idExample)) : "{id}";
      const routes = [
        [`GET /api/v1/${name}`, "Paginated records"],
        [`GET /api/v1/${name}/{id}`, "One record"],
        [`GET /api/v1/metadata/${name}`, "These fields, types and example values"],
        [`GET /api/v1/schema/${name}`, "Machine-readable schema for code generators"],
        [`GET /api/v1/search?q=…&dataset=${name}`, "Search inside this dataset"],
      ];
      const endpoints = $("[data-ds-endpoints]");
      routes.forEach(([route, returns]) => { const tr = document.createElement("tr"); tr.append(codeCell(route), el("td", returns)); endpoints.append(tr); });

      $("[data-ds-curl]").textContent = `curl "${base}/${path}?per_page=5"\ncurl "${base}/${path}/${exampleId}"`;
      $("[data-ds-js]").textContent = `const res = await fetch("${base}/${path}?per_page=5");\nconst { data, total } = await res.json();\n\nconst one = await fetch("${base}/${path}/${exampleId}");`;

      const order = (k) => (k === "id" ? 0 : k === "name" ? 1 : 2);
      const rows = $("[data-ds-fields]");
      fields.sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)).forEach(([key, f]) => {
        const tr = document.createElement("tr");
        const coverage = f.optional ? `${fmt(f.presentCount)} / ${fmt(total)} (optional)` : "all records";
        tr.append(codeCell(key), codeCell(typeOf(f)), el("td", coverage), f.example == null ? el("td", "—", "muted") : codeCell(clip(stringify(f.example))));
        rows.append(tr);
      });

      const skip = new Set(["id", "name", "image", "_image", "description"]);
      const filterable = fields.filter(([k, f]) => !skip.has(k) && f.types.includes("string")).map(([k]) => k);
      const list = $("[data-ds-filters]");
      if (filterable.length) {
        const [first] = filterable;
        const sample = encodeURIComponent(String(meta.fields[first].example ?? "value"));
        $("[data-ds-filters-lead]").textContent = `Any string field filters with ?field=value, for example ?${first}=${decodeURIComponent(sample)}. Fields you can filter on here:`;
        filterable.forEach((k) => { const li = document.createElement("li"); li.append(el("code", k)); list.append(li); });
      } else {
        $("[data-ds-filters-lead]").textContent = "This dataset has no string fields to filter on. Use search= to find records by text.";
      }
      $("[data-ds-explorer]").href = `/explorer/?dataset=${path}`;
      $("[data-ds-content]").hidden = false;
    })
    .catch(() => fail("Could not load this dataset right now. Try again in a moment."));
})();
