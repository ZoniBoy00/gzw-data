(() => {
  const API_BASE = "/api/v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { dataset: "weapons", query: "", page: 1, perPage: 8, stats: null, counts: null, snapshotCounts: null, datasetEntries: [], datasetMenuRendered: false };

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

  // Combined views (e.g. "armor") re-expose records of other datasets, so they are not counted twice.
  function normaliseDatasetEntries(stats) {
    const datasets = stats?.datasets || stats?.data || {};
    return (Array.isArray(datasets) ? datasets : Object.entries(datasets).map(([name, value]) => ({ name, count: value?.total ?? value?.count ?? value ?? 0, derived: Boolean(value?.sources) })))
      .map((item) => ({ ...item, name: String(item.name), count: Number(item.count ?? item.total ?? 0), derived: Boolean(item.derived) }))
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

  // The headline numbers and the maintenance panel must agree: prefer the /stats figures (combined views excluded).
  function applyCounts() {
    const counts = state.counts || state.snapshotCounts;
    if (!counts) return;
    setText("#update-datasets", `${formatNumber(counts.datasets)} datasets`);
    setText("#update-records", formatNumber(counts.records));
  }

  function renderStats(stats) {
    const entries = normaliseDatasetEntries(stats);
    state.datasetEntries = entries;
    const sourceEntries = entries.filter((item) => !item.derived);
    const total = sourceEntries.reduce((sum, item) => sum + item.count, 0);
    state.counts = { datasets: sourceEntries.length, records: total };
    applyCounts();
    setText("[data-stat=datasets]", sourceEntries.length);
    setText("[data-stat=items]", formatNumber(total));
    setText("[data-stat=status]", "API online");
    renderCatalog(entries);
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

  const GROUPS = [
    ["Weapons & ammo", /weapon|ammo|magazine|attachment|scope|optic|grenade|muzzle|barrel|stock|grip|firearm|launcher|collimator|iron_sight|mount|suppressor|handguard|receiver|gas_block|charging|buffer|mortar|throwable|slide|foregrip/i],
    ["Armor & gear", /armor|armour|vest|helmet|plate|backpack|rig|clothing|headset|mask|gear|uniform|carrier|equipment|tactical|apparel|shirt|trouser|boot|glove|glass|belt|face_cover|night_vision|binocular|auxiliary/i],
    ["Missions & vendors", /task|mission|quest|vendor|trader|faction|reputation|contract|intel|reading/i],
    ["World & enemies", /region|boss|map|location|zone|lz|npc|enemy|key|newspaper|poi/i],
    ["Items & loot", /loot|item|consumable|medical|food|material|valuable|barter|medicine|drug|tool|drink|provision|electronic|paper|jewel|fund|container|lockbox|laboratory|household|workshop|cleanup/i],
  ];
  const groupOf = (name) => (GROUPS.find(([, re]) => re.test(name)) || ["Other", null])[0];

  function selectDataset(name) {
    state.dataset = name;
    state.page = 1;
    state.datasetMenuRendered = false;
    const count = state.datasetEntries.find((item) => item.name === name)?.count || 0;
    setText("#dataset-label", `${name} · ${formatNumber(count)}`);
    loadExplorer();
    $("#explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const CATALOG_PREVIEW = 14;

  function renderCatalog(entries) {
    const root = $("#catalog");
    if (!root) return;
    const groups = new Map();
    entries.forEach((item) => {
      const name = item.name.replace(/^\//, "").replace(/^api\//, "");
      const key = groupOf(name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ name, count: item.count, derived: item.derived });
    });
    const order = [...GROUPS.map(([label]) => label), "Other"].filter((label) => groups.has(label));
    root.innerHTML = order.map((label) => {
      const items = groups.get(label);
      const chips = items.map((item, index) => `<button class="chip${item.derived ? " chip-view" : ""}" type="button" data-dataset="${escapeHtml(item.name)}"${index >= CATALOG_PREVIEW ? " data-extra hidden" : ""}${item.derived ? ' title="Combined view of other datasets"' : ""}>${escapeHtml(item.name)}<small>${formatNumber(item.count)}</small></button>`).join("");
      const more = items.length > CATALOG_PREVIEW ? `<button class="chip chip-more" type="button" data-more aria-expanded="false">Show all ${items.length}</button>` : "";
      return `<div class="catalog-group"><h3>${escapeHtml(label)} <span>${items.length}</span></h3><div class="catalog-chips">${chips}${more}</div></div>`;
    }).join("") + `<div class="catalog-empty" hidden>No dataset matches your filter.</div>`;
    setText("#catalog-meta", `${entries.filter((item) => !item.derived).length} datasets`);

    root.addEventListener("click", (event) => {
      const more = event.target.closest("[data-more]");
      if (more) {
        const expanded = more.getAttribute("aria-expanded") === "true";
        more.setAttribute("aria-expanded", String(!expanded));
        $$("[data-extra]", more.parentElement).forEach((chip) => { chip.hidden = expanded; });
        more.textContent = expanded ? `Show all ${$$(".chip[data-dataset]", more.parentElement).length}` : "Show less";
        return;
      }
      const chip = event.target.closest("[data-dataset]");
      if (chip) selectDataset(chip.dataset.dataset);
    });

    $("#catalog-filter")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      let visible = 0;
      $$(".catalog-group", root).forEach((group) => {
        const chips = $$(".chip[data-dataset]", group);
        const more = $("[data-more]", group);
        let matches = 0;
        chips.forEach((chip) => {
          const match = !query || chip.dataset.dataset.toLowerCase().includes(query);
          const collapsed = !query && chip.hasAttribute("data-extra") && more?.getAttribute("aria-expanded") !== "true";
          chip.hidden = !match || collapsed;
          if (match) matches += 1;
        });
        if (more) more.hidden = Boolean(query);
        group.hidden = matches === 0;
        visible += matches;
      });
      $(".catalog-empty", root).hidden = visible > 0;
    });
  }

  async function initHeroPreview() {
    const target = $("#hero-json code");
    if (!target) return;
    try {
      const payload = await fetchJson("/weapons?per_page=1");
      const text = JSON.stringify(payload, null, 2);
      target.textContent = text.length > 900 ? `${text.slice(0, 900)}
  …` : text;
    } catch { /* keep the static sample */ }
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
      setText("[data-stat=status]", "API unavailable");
      setText("#catalog-meta", "");
      const catalog = $("#catalog");
      if (catalog) catalog.innerHTML = `<div class="error-message">Dataset list unavailable right now. Try the <a href="/playground/">Playground</a> or open <code>/api/v1/stats</code> directly.</div>`;
      const body = $("#explorer-body");
      if (body) body.innerHTML = `<tr><td colspan="3"><div class="error-message">The API status could not be loaded right now.</div></td></tr>`;
    }
    await explorerPromise;
  }

  function initHomeSpy() {
    if (document.body.dataset.page !== "overview") return;
    const links = $$('.sidebar a[href^="#"]');
    const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    if (!sections.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // The active section is the last one whose top has passed the sticky header.
      const current = sections.filter((section) => section.getBoundingClientRect().top <= 140).pop() || sections[0];
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${current.id}`));
    };
    window.addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    frame = requestAnimationFrame(update);
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
      const entries = (Array.isArray(datasets) ? datasets : Object.entries(datasets).map(([name, value]) => ({ name, count: value?.total ?? value?.count ?? value ?? 0, derived: Boolean(value?.sources) })))
        .map((item) => ({ name: String(item.name).replace(/^\//, "").replace(/^api\//, ""), count: Number(item.count ?? item.total ?? 0), derived: Boolean(item.derived) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      list.classList.add("endpoint-grid");
      list.innerHTML = entries.map((item) => `<a class="endpoint-chip" href="/api/v1/${escapeHtml(item.name)}" target="_blank" rel="noopener" data-name="${escapeHtml(item.name)}"><span class="path"><b>${escapeHtml(item.name)}</b></span><small>${formatNumber(item.count)}${item.derived ? " · view" : ""}</small></a>`).join("");
      if (!$("#endpoint-filter")) {
        const filter = document.createElement("input");
        filter.className = "field endpoint-filter";
        filter.id = "endpoint-filter";
        filter.type = "search";
        filter.placeholder = "Filter endpoints…";
        filter.setAttribute("aria-label", "Filter endpoints");
        filter.addEventListener("input", () => {
          const query = filter.value.trim().toLowerCase();
          $$(".endpoint-chip", list).forEach((chip) => { chip.hidden = Boolean(query) && !chip.dataset.name.toLowerCase().includes(query); });
        });
        const note = document.createElement("p");
        note.className = "docs-note";
        note.innerHTML = "Every dataset is a <code>GET /api/v1/&lt;name&gt;</code> endpoint. The number is the record count.";
        list.before(note, filter);
      }
      setText("[data-doc-count]", entries.filter((item) => !item.derived).length);
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
    const responseTitle = $("#playground-response-title");
    const run = $("#playground-run");
    if (!endpoint || !fields || !url || !output || !meta || !responseTitle || !run) return;

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
      responseTitle.textContent = "Request in progress";
      meta.textContent = "Fetching live API response…";
      output.textContent = "Loading…";
      try {
        const response = await fetch(requestUrl, { headers: { Accept: "application/json" } });
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        output.textContent = typeof body === "string" ? body : JSON.stringify(body, null, 2);
        responseTitle.textContent = response.ok ? "Response received" : "Request returned an error";
        meta.textContent = `${response.ok ? "200 OK" : `HTTP ${response.status}`} · ${Math.round(performance.now() - started)} ms`;
      } catch (error) {
        output.textContent = error instanceof Error ? error.message : "Request failed";
        responseTitle.textContent = "Could not reach the API";
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
    void execute();
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
      state.snapshotCounts = { datasets: datasetCount, records: recordCount };
      applyCounts();
      setText("#update-changes", changeData.hasHistory ? `${changed} changed` : "First snapshot");
      setText("#update-status", "Live metadata");
      setText("#update-note", changeData.hasHistory ? `${formatNumber(added)} datasets added · ${formatNumber(removed)} removed · counts compared with the previous snapshot.` : "This is the first stored snapshot. Dataset-level changes will appear after the next snapshot.");
    } catch {
      setText("#update-status", "Metadata unavailable");
      setText("#update-note", "The API is available, but snapshot metadata could not be loaded right now.");
    }
  }

  initShell();
  initOverview();
  initHeroPreview();
  initDocs();
  initPlayground();
  initUpdatePanel();
  initScrollspy();
  initHomeSpy();
})();
