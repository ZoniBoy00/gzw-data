(() => {
  const API_BASE = "/api/v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { dataset: "weapons", query: "", page: 1, perPage: 8, stats: null, datasetEntries: [], datasetMenuRendered: false };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[char]));

  const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" }, ...options });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function openMenu() {
    $(".sidebar")?.classList.add("open");
    $(".scrim")?.classList.add("open");
    $(".mobile-menu")?.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    $(".sidebar")?.classList.remove("open");
    $(".scrim")?.classList.remove("open");
    $(".mobile-menu")?.setAttribute("aria-expanded", "false");
  }

  function openCommandPalette() {
    const palette = $(".command-scrim");
    if (!palette) return;
    palette.classList.add("open");
    palette.setAttribute("aria-hidden", "false");
    $(".command-input")?.focus();
  }

  function closeCommandPalette() {
    const palette = $(".command-scrim");
    if (!palette) return;
    palette.classList.remove("open");
    palette.setAttribute("aria-hidden", "true");
  }

  function initShell() {
    $(".mobile-menu")?.addEventListener("click", () => {
      $(".sidebar")?.classList.contains("open") ? closeMenu() : openMenu();
    });
    $(".scrim")?.addEventListener("click", closeMenu);
    $$(".sidebar a").forEach((link) => link.addEventListener("click", closeMenu));
    $(".search-trigger")?.addEventListener("click", openCommandPalette);
    $(".command-scrim")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCommandPalette();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        openCommandPalette();
      }
      if (event.key === "Escape") {
        closeCommandPalette();
        closeMenu();
        $("#dataset-menu")?.classList.remove("open");
        $("#dataset-trigger")?.setAttribute("aria-expanded", "false");
      }
    });

    const commandInput = $(".command-input");
    commandInput?.addEventListener("input", () => {
      const query = commandInput.value.toLowerCase().trim();
      $$(".command-item").forEach((item) => {
        item.hidden = query && !item.textContent.toLowerCase().includes(query);
      });
    });
    $$(".command-item").forEach((item) => item.addEventListener("click", () => {
      const target = item.dataset.target;
      if (target) window.location.href = target;
    }));

    $$('[data-copy], [data-copy-target]').forEach((button) => button.addEventListener("click", async () => {
      const value = button.dataset.copyTarget ? document.getElementById(button.dataset.copyTarget)?.textContent : button.dataset.copy;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const original = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = original; }, 1200);
      } catch { button.textContent = "Select manually"; }
    }));

    $$("[data-tabs]").forEach((group) => {
      $$(".tab", group).forEach((tab) => tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        $$(".tab", group).forEach((item) => item.classList.toggle("active", item === tab));
        $$(".tab-panel", group.parentElement).forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target));
      }));
    });
  }

  function normaliseDatasetEntries(stats) {
    const datasets = stats?.datasets || stats?.data || {};
    return (Array.isArray(datasets) ? datasets : Object.entries(datasets).map(([name, value]) => ({ name, count: value?.total ?? value?.count ?? value ?? 0 })))
      .map((item) => ({ ...item, name: String(item.name), count: Number(item.count ?? item.total ?? 0) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderDatasetMenu(menu) {
    if (!menu || state.datasetMenuRendered) return;
    menu.innerHTML = state.datasetEntries.map((item) => {
      const name = item.name.replace(/^\//, "").replace(/^api\//, "");
      return `<button class="dataset-option" type="button" role="option" data-value="${escapeHtml(name)}" aria-selected="${name === state.dataset}"><span>${escapeHtml(name)}</span><span class="dataset-option-count">${formatNumber(item.count)}</span></button>`;
    }).join("");
    state.datasetMenuRendered = true;
  }

  function renderStats(stats) {
    const entries = normaliseDatasetEntries(stats);
    state.datasetEntries = entries;
    const total = entries.reduce((sum, item) => sum + item.count, 0);
    setText("[data-stat=datasets]", entries.length);
    setText("[data-stat=items]", formatNumber(total));
    setText("[data-stat=status]", "Online");
    setText("[data-stat=updated]", stats?.lastScrapedAt
      ? new Date(stats.lastScrapedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "Unknown");

    const picker = $("#dataset-picker");
    const trigger = $("#dataset-trigger");
    const label = $("#dataset-label");
    const menu = $("#dataset-menu");
    if (!picker || !trigger || !label || !menu) return;
    if (!entries.some((item) => item.name === state.dataset)) state.dataset = entries[0]?.name || "weapons";
    label.textContent = `${state.dataset} · ${formatNumber(entries.find((item) => item.name === state.dataset)?.count || 0)}`;
    if (trigger.dataset.bound !== "true") {
      trigger.dataset.bound = "true";
      trigger.addEventListener("click", () => {
        renderDatasetMenu(menu);
        const open = menu.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) {
          menu.classList.remove("open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    }
    if (menu.dataset.bound !== "true") {
      menu.dataset.bound = "true";
      menu.addEventListener("click", (event) => {
        const option = event.target.closest(".dataset-option");
        if (!option) return;
        state.dataset = option.dataset.value;
        label.textContent = `${state.dataset} · ${option.querySelector(".dataset-option-count").textContent}`;
        $$(".dataset-option", menu).forEach((item) => item.setAttribute("aria-selected", String(item === option)));
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        state.page = 1;
        loadExplorer();
      });
    }
  }

  function renderRows(payload) {
    const body = $("#explorer-body");
    const meta = $("#explorer-meta");
    if (!body) return;
    const rows = Array.isArray(payload) ? payload : (payload?.data || []);
    const total = payload?.total ?? payload?.count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.perPage));
    const previous = $("#previous-page");
    const next = $("#next-page");
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="3"><div class="table-empty"><strong>No records found</strong>Try another dataset or search term.</div></td></tr>`;
    } else {
      body.innerHTML = rows.slice(0, state.perPage).map((item) => {
        const name = item.name || item.title || item.id || "Unnamed record";
        const id = item.id || "—";
        const detail = Object.entries(item).filter(([key]) => !["id", "name", "image"].includes(key)).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Structured game data";
        return `<tr><td>${escapeHtml(name)}</td><td class="mono">${escapeHtml(id)}</td><td>${escapeHtml(detail)}</td></tr>`;
      }).join("");
    }
    if (meta) meta.textContent = `${formatNumber(rows.length)} shown · ${formatNumber(total)} total`;
    if (previous) previous.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= totalPages || !rows.length;
    setText("#page-label", `Page ${state.page} / ${totalPages}`);
  }

  async function loadExplorer() {
    const body = $("#explorer-body");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="3"><div class="loading">Loading live records…</div></td></tr>`;
    const params = new URLSearchParams({ page: state.page, per_page: state.perPage });
    if (state.query) params.set("search", state.query);
    try {
      const payload = await fetchJson(`/${encodeURIComponent(state.dataset)}?${params}`);
      const rows = Array.isArray(payload) ? payload : (payload?.data || []);
      const total = payload?.total ?? payload?.count ?? rows.length;
      const totalPages = Math.max(1, Math.ceil(total / state.perPage));
      if (state.page > totalPages) {
        state.page = totalPages;
        return loadExplorer();
      }
      renderRows(payload);
    } catch (error) {
      body.innerHTML = `<tr><td colspan="3"><div class="error-message">Could not load this dataset. Check the API status and try again.</div></td></tr>`;
      setText("#explorer-meta", error.message);
    }
  }

  async function initOverview() {
    if (!$("#explorer-body")) return;
    $("#dataset-select")?.addEventListener("change", (event) => { state.dataset = event.target.value; state.page = 1; loadExplorer(); });
    let timer;
    $("#explorer-search")?.addEventListener("input", (event) => {
      clearTimeout(timer);
      state.query = event.target.value.trim();
      timer = setTimeout(() => { state.page = 1; loadExplorer(); }, 260);
    });
    $("#next-page")?.addEventListener("click", () => { state.page += 1; loadExplorer(); });
    $("#previous-page")?.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadExplorer(); } });

    const statsPromise = fetchJson("/stats");
    const explorerPromise = loadExplorer();
    try {
      state.stats = await statsPromise;
      renderStats(state.stats);
    } catch (error) {
      setText("[data-stat=status]", "Unavailable");
      const body = $("#explorer-body");
      if (body) body.innerHTML = `<tr><td colspan="3"><div class="error-message">The API status could not be loaded right now.</div></td></tr>`;
    }
    await explorerPromise;
  }

  function initScrollspy() {
    const links = $$(".anchor-nav a");
    if (!links.length) return;
    const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
      });
    }, { rootMargin: "-90px 0px -62% 0px" });
    sections.forEach((section) => observer.observe(section));
  }

  async function initDocs() {
    const list = $("#endpoint-list");
    if (!list) return;
    try {
      const payload = await fetchJson("/stats");
      const datasets = payload?.datasets || payload?.data || {};
      const entries = Array.isArray(datasets) ? datasets : Object.entries(datasets).map(([name, value]) => ({ name, count: value?.total ?? value?.count ?? value ?? 0 }));
      list.innerHTML = entries.sort((a, b) => String(a.name).localeCompare(String(b.name))).map((item) => {
        const name = String(item.name).replace(/^\//, "").replace(/^api\//, "");
        return `<div class="endpoint-row"><span class="method">GET</span><span class="path">/api/v1/${escapeHtml(name)}</span><span class="endpoint-desc">${formatNumber(item.count || item.total || 0)} records · auto-discovered dataset</span><span class="endpoint-tag">JSON</span></div>`;
      }).join("");
      setText("[data-doc-count]", entries.length);
    } catch {
      list.innerHTML = `<div class="error-message">Endpoint catalog unavailable. The static reference below is still usable.</div>`;
    }
  }

  function initPlayground() {
    const endpoint = $("#playground-endpoint");
    const fields = $("#playground-fields");
    const url = $("#playground-url");
    const output = $("#playground-output code");
    const meta = $("#playground-result-meta");
    const run = $("#playground-run");
    if (!endpoint || !fields || !url || !output || !meta || !run) return;

    const configs = {
      weapons: { path: "/weapons", description: "List weapon records with pagination.", fields: [['page', '1'], ['per_page', '5']] },
      'weapon-record': { path: "/weapons/ak-12", description: "Fetch one weapon by its record ID.", fields: [] },
      search: { path: "/search", description: "Search across the available datasets.", fields: [['q', 'AK']] },
      stats: { path: "/stats", description: "Show record totals by dataset.", fields: [] },
      health: { path: "/health", description: "Check API readiness and data status.", fields: [] },
      metadata: { path: "/metadata?full=true", description: "Inspect dataset names, fields and counts.", fields: [] },
    };

    const renderFields = () => {
      const config = configs[endpoint.value];
      fields.replaceChildren();
      config.fields.forEach(([name, value]) => {
        const label = document.createElement("label");
        label.className = "playground-field";
        const caption = document.createElement("span");
        caption.textContent = name;
        const input = document.createElement("input");
        input.className = "field";
        input.dataset.playgroundParam = name;
        input.value = value;
        label.append(caption, input);
        fields.append(label);
      });
      setUrl();
    };

    const setUrl = () => {
      const config = configs[endpoint.value];
      const params = new URLSearchParams();
      $$("[data-playground-param]", fields).forEach((input) => { if (input.value.trim()) params.set(input.dataset.playgroundParam, input.value.trim()); });
      const query = params.toString();
      const path = config.path.includes("?") ? `${config.path}&${query}` : `${config.path}${query ? `?${query}` : ""}`;
      url.textContent = `${API_BASE}${path}`;
      meta.textContent = config.description;
    };

    const execute = async () => {
      setUrl();
      const started = performance.now();
      const requestUrl = url.textContent;
      run.disabled = true;
      run.textContent = "Running…";
      meta.textContent = "Request in progress…";
      output.textContent = "Loading…";
      try {
        const response = await fetch(requestUrl, { headers: { Accept: "application/json" } });
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        output.textContent = typeof body === "string" ? body : JSON.stringify(body, null, 2);
        meta.textContent = `${response.ok ? "200 OK" : `HTTP ${response.status}`} · ${Math.round(performance.now() - started)} ms`;
      } catch (error) {
        output.textContent = error instanceof Error ? error.message : "Request failed";
        meta.textContent = "Request failed · check the API status and try again";
      } finally {
        run.disabled = false;
        run.textContent = "Run request";
      }
    };

    endpoint.addEventListener("change", renderFields);
    fields.addEventListener("input", setUrl);
    run.addEventListener("click", execute);
    renderFields();
  }

  async function initUpdatePanel() {
    const panel = $("#update-title");
    if (!panel) return;
    try {
      const [version, changes] = await Promise.all([fetchJson("/version"), fetchJson("/changes")]);
      const snapshot = version?.data?.snapshot || changes?.data?.current;
      const datasets = snapshot?.datasets || {};
      const datasetCount = Number(version?.data?.datasetCount) || Object.keys(datasets).length;
      const recordCount = Object.values(datasets).reduce((total, value) => total + (Number(value) || 0), 0);
      const changeData = changes?.data || {};
      const changed = changeData.changes?.datasets?.length || 0;
      const added = changeData.changes?.added?.length || 0;
      const removed = changeData.changes?.removed?.length || 0;
      const snapshotDate = snapshot?.capturedAt || version?.data?.dataVersion;
      const formattedDate = snapshotDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(snapshotDate)) : "Unavailable";
      setText("#update-version", formattedDate);
      setText("#update-datasets", `${formatNumber(datasetCount)} datasets`);
      setText("#update-records", formatNumber(recordCount));
      setText("#update-changes", changeData.hasHistory ? `${changed} changed` : "First snapshot");
      setText("#update-status", "Live metadata");
      setText("#update-note", changeData.hasHistory ? `${formatNumber(added)} datasets added · ${formatNumber(removed)} removed · counts compared with the previous snapshot.` : "This is the first stored snapshot. Dataset-level changes will appear after the next snapshot.");
    } catch {
      setText("#update-status", "Metadata unavailable");
      setText("#update-note", "The API is available, but snapshot metadata could not be loaded right now.");
    }
  }

  const originalTitle = document.title;
  const awayTitle = "Come back, I miss you :(";

  document.addEventListener("visibilitychange", () => {
    document.title = document.hidden ? awayTitle : originalTitle;
  });

  document.title = originalTitle;

  initShell();
  initOverview();
  initDocs();
  initPlayground();
  initUpdatePanel();
  initScrollspy();
})();
