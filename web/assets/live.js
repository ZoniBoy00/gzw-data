// Data explorer and data status: both read the live API.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = "/api/v1";
  const fmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
  const when = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const getJson = async (path) => {
    const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(body?.error?.message || `HTTP ${res.status}`); err.status = res.status; throw err; }
    return body;
  };
  const cell = (tag, text, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };

  // Explorer
  const ex = $("[data-explorer]");
  if (ex) {
    const dataset = $("#ex-dataset"), search = $("#ex-search"), rows = $("[data-ex-rows]", ex);
    const summary = $("[data-ex-summary]", ex), pageLabel = $("[data-ex-page]", ex), json = $("[data-ex-json]", ex);
    const prev = $("[data-ex-prev]", ex), next = $("[data-ex-next]", ex);
    const preset = new URLSearchParams(location.search).get("dataset");
    if (preset && /^[w.-]+$/.test(preset)) dataset.value = preset;
    const state = { page: 1, perPage: 10, totalPages: 1, token: 0, timer: 0 };
    const HIDDEN = new Set(["name", "id", "image", "numeric_values"]);

    const preview = (record) => Object.entries(record)
      .filter(([k, v]) => !HIDDEN.has(k) && (typeof v === "string" || typeof v === "number") && String(v).trim())
      .slice(0, 3)
      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${String(v).length > 48 ? `${String(v).slice(0, 47)}…` : v}`)
      .join(", ");

    const load = async () => {
      const name = dataset.value.trim();
      const token = ++state.token;
      if (!name) { summary.textContent = "Enter a dataset name, for example weapons."; return; }
      const params = new URLSearchParams({ page: String(state.page), per_page: String(state.perPage) });
      if (search.value.trim()) params.set("search", search.value.trim());
      json.href = `${API}/${encodeURIComponent(name)}?${params}`;
      rows.classList.add("busy");
      summary.classList.remove("bad");
      try {
        const payload = await getJson(`/${encodeURIComponent(name)}?${params}`);
        if (token !== state.token) return;
        const list = Array.isArray(payload.data) ? payload.data : [];
        state.totalPages = Math.max(1, payload.totalPages || 1);
        rows.textContent = "";
        list.forEach((record) => {
          const tr = document.createElement("tr");
          const nameCell = document.createElement("td");
          const id = record.id ?? "";
          const label = record.name || record.title || id || "Unnamed record";
          if (id) {
            const a = document.createElement("a");
            a.href = `${API}/${encodeURIComponent(name)}/${encodeURIComponent(id)}`;
            a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = label;
            nameCell.append(a);
          } else nameCell.textContent = label;
          const idCell = document.createElement("td"), code = document.createElement("code");
          code.textContent = id || "none"; idCell.append(code);
          tr.append(nameCell, idCell, cell("td", preview(record), "ex-preview"));
          rows.append(tr);
        });
        const total = payload.total ?? list.length;
        const from = list.length ? (state.page - 1) * state.perPage + 1 : 0;
        summary.textContent = list.length
          ? `Showing ${fmt(from)}–${fmt(from + list.length - 1)} of ${fmt(total)} in ${name}.`
          : `No records match${search.value.trim() ? ` “${search.value.trim()}”` : ""} in ${name}. Try fewer words or another dataset.`;
      } catch (err) {
        if (token !== state.token) return;
        rows.textContent = "";
        state.totalPages = 1;
        summary.classList.add("bad");
        summary.textContent = err.status === 404
          ? `There is no dataset called “${name}”. Pick one from the list.`
          : `Could not load records: ${err.message}. Try again in a moment.`;
      }
      rows.classList.remove("busy");
      pageLabel.textContent = `Page ${state.page} of ${state.totalPages}`;
      prev.disabled = state.page <= 1;
      next.disabled = state.page >= state.totalPages;
    };

    const reset = () => { state.page = 1; load(); };
    dataset.addEventListener("change", reset);
    dataset.addEventListener("keydown", (e) => { if (e.key === "Enter") reset(); });
    search.addEventListener("input", () => { clearTimeout(state.timer); state.timer = setTimeout(reset, 250); });
    prev.addEventListener("click", () => { state.page -= 1; load(); });
    next.addEventListener("click", () => { state.page += 1; load(); });

    getJson("/stats").then(({ data }) => {
      const list = $("#ex-datasets");
      Object.keys(data).sort().forEach((n) => list.append(new Option(n)));
    }).catch(() => { /* typing a name still works */ });
    load();
  }

  // Data status
  const status = $("[data-status-page]");
  if (status) {
    const put = (key, text) => { const el = $(`[data-kv="${key}"]`, status); if (el) el.textContent = text; };
    const fresh = $("[data-fresh]", status);
    Promise.all([getJson("/version"), getJson("/changes")]).then(([version, changes]) => {
      const v = version.data || {}, c = changes.data || {};
      const snapshot = v.snapshot || c.current || {};
      const counts = snapshot.datasets || {};
      put("api", `v${v.implementationVersion} (API ${v.apiVersion})`);
      put("data", v.dataVersion || "unknown");
      put("scrape", v.lastFullScrapeAt ? when(v.lastFullScrapeAt) : "unknown");
      put("snapshot", snapshot.snapshotId ? `${snapshot.snapshotId}, captured ${when(snapshot.capturedAt)}` : "unknown");
      put("datasets", fmt(Object.keys(counts).length));
      put("records", fmt(Object.values(counts).reduce((s, n) => s + n, 0)));
      put("history", c.hasHistory ? `${fmt(c.historyCount)} stored snapshots` : "First snapshot");

      const days = v.lastFullScrapeAt ? Math.floor((Date.now() - Date.parse(v.lastFullScrapeAt)) / 86400000) : null;
      if (days === null) { fresh.textContent = "Could not determine when the data was last scraped."; fresh.classList.add("bad"); }
      else {
        const ago = days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
        fresh.classList.add(days <= 10 ? "ok" : "bad");
        fresh.textContent = days <= 10 ? `Data is current. Last full scrape ${ago}.` : `Data may be stale. Last full scrape ${ago}.`;
      }

      const list = c.changes?.datasets || [];
      const added = c.changes?.added?.length || 0, removed = c.changes?.removed?.length || 0;
      put("note", c.hasHistory
        ? `${fmt(added)} datasets added, ${fmt(removed)} removed and ${fmt(list.length)} changed in size since the previous snapshot.`
        : "This is the first stored snapshot, so there is nothing to compare yet.");
      if (list.length) {
        const tbody = $("[data-changes]", status);
        list.forEach((row) => {
          const tr = document.createElement("tr");
          const name = document.createElement("td"), code = document.createElement("code");
          code.textContent = row.dataset; name.append(code);
          tr.append(name, cell("td", fmt(row.before)), cell("td", fmt(row.after)),
            cell("td", `${row.delta > 0 ? "+" : ""}${fmt(row.delta)}`, row.delta > 0 ? "delta-up" : "delta-down"));
          tbody.append(tr);
        });
        $("[data-changes-wrap]", status).hidden = false;
      }
    }).catch((err) => {
      fresh.classList.add("bad");
      fresh.textContent = `Could not load the snapshot: ${err.message}. Try again in a moment.`;
    });
  }
})();
