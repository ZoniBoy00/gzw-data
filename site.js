(() => {
  const API_BASE = "/api";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { dataset: "weapons", query: "", page: 1, perPage: 8, stats: null };

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

    $$("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
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

  function renderStats(stats) {
    const datasets = stats?.datasets || stats?.data || {};
    const entries = (Array.isArray(datasets) ? datasets : Object.entries(datasets).map(([name, value]) => ({ name, count: value?.total ?? value?.count ?? value ?? 0 })))
      .map((item) => ({ ...item, count: Number(item.count ?? item.total ?? 0) }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const total = entries.reduce((sum, item) => sum + item.count, 0);
    setText("[data-stat=datasets]", entries.length);
    setText("[data-stat=items]", formatNumber(total));
    setText("[data-stat=status]", "Online");
    setText("[data-stat=updated]", new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }));

    const picker = $("#dataset-picker");
    const trigger = $("#dataset-trigger");
    const label = $("#dataset-label");
    const menu = $("#dataset-menu");
    if (!picker || !trigger || !label || !menu) return;
    menu.innerHTML = entries.map((item) => {
      const name = String(item.name).replace(/^\//, "").replace(/^api\//, "");
      return `<button class="dataset-option" type="button" role="option" data-value="${escapeHtml(name)}" aria-selected="${name === state.dataset}"><span>${escapeHtml(name)}</span><span class="dataset-option-count">${formatNumber(item.count)}</span></button>`;
    }).join("");
    if (!entries.some((item) => String(item.name) === state.dataset)) state.dataset = String(entries[0]?.name || "weapons");
    label.textContent = `${state.dataset} · ${formatNumber(entries.find((item) => String(item.name) === state.dataset)?.count || 0)}`;
    if (trigger.dataset.bound !== "true") {
      trigger.dataset.bound = "true";
      trigger.addEventListener("click", () => {
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
    $$(".dataset-option", menu).forEach((option) => option.addEventListener("click", () => {
      state.dataset = option.dataset.value;
      label.textContent = `${state.dataset} · ${option.querySelector(".dataset-option-count").textContent}`;
      $$(".dataset-option", menu).forEach((item) => item.setAttribute("aria-selected", String(item === option)));
      menu.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      state.page = 1;
      loadExplorer();
    }));
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
    try {
      state.stats = await fetchJson("/stats");
      renderStats(state.stats);
      await loadExplorer();
    } catch (error) {
      setText("[data-stat=status]", "Unavailable");
      const body = $("#explorer-body");
      if (body) body.innerHTML = `<tr><td colspan="3"><div class="error-message">The API status could not be loaded right now.</div></td></tr>`;
    }
    $("#dataset-select")?.addEventListener("change", (event) => { state.dataset = event.target.value; state.page = 1; loadExplorer(); });
    let timer;
    $("#explorer-search")?.addEventListener("input", (event) => {
      clearTimeout(timer);
      state.query = event.target.value.trim();
      timer = setTimeout(() => { state.page = 1; loadExplorer(); }, 260);
    });
    $("#next-page")?.addEventListener("click", () => { state.page += 1; loadExplorer(); });
    $("#previous-page")?.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadExplorer(); } });
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
        return `<div class="endpoint-row"><span class="method">GET</span><span class="path">/api/${escapeHtml(name)}</span><span class="endpoint-desc">${formatNumber(item.count || item.total || 0)} records · auto-discovered dataset</span><span class="endpoint-tag">JSON</span></div>`;
      }).join("");
      setText("[data-doc-count]", entries.length);
    } catch {
      list.innerHTML = `<div class="error-message">Endpoint catalog unavailable. The static reference below is still usable.</div>`;
    }
  }

  initShell();
  initOverview();
  initDocs();
  initScrollspy();
})();
