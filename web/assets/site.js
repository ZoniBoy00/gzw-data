(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = "/api/v1";
  const fmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Count a number up from zero once data arrives; jump straight to it with reduced motion.
  function countUp(el, to) {
    if (reduced.matches || to < 2) { el.textContent = fmt(to); return; }
    const start = performance.now(), duration = 800;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Mobile drawer
  const sidebar = $(".sidebar"), scrim = $(".scrim"), menuBtn = $(".menu-btn");
  const setMenu = (open) => {
    sidebar.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) $("a", sidebar)?.focus(); else if (sidebar.contains(document.activeElement)) menuBtn.focus();
  };
  menuBtn?.addEventListener("click", () => setMenu(!sidebar.classList.contains("open")));
  scrim?.addEventListener("click", () => setMenu(false));

  // Scrollable code regions must be reachable by keyboard
  $$(".code pre, .try pre").forEach((pre) => pre.setAttribute("tabindex", "0"));

  // Copy buttons
  const SVG = "http://www.w3.org/2000/svg";
  const iconEl = (name) => {
    const svg = document.createElementNS(SVG, "svg"), use = document.createElementNS(SVG, "use");
    svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    use.setAttribute("href", `#i-${name}`); svg.append(use);
    return { svg, use };
  };
  $$(".code").forEach((block) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "copy";
    btn.setAttribute("aria-label", "Copy code");
    const { svg, use } = iconEl("copy"), label = document.createElement("span");
    label.textContent = "Copy";
    btn.append(svg, label);
    btn.addEventListener("click", async () => {
      let ok = true;
      try { await navigator.clipboard.writeText($("pre", block).innerText); } catch { ok = false; }
      label.textContent = ok ? "Copied" : "Press Ctrl+C";
      use.setAttribute("href", ok ? "#i-check" : "#i-copy");
      btn.classList.toggle("done", ok);
      setTimeout(() => { label.textContent = "Copy"; use.setAttribute("href", "#i-copy"); btn.classList.remove("done"); }, 1600);
    });
    block.append(btn);
  });

  // Keep the current page visible in a long sidebar

  // Tabs with roving tabindex and arrow keys
  $$(".tabset").forEach((set) => {
    const tabs = $$('[role="tab"]', set), panels = $$('[role="tabpanel"]', set);
    const select = (i, focus) => tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
      if (on && focus) t.focus();
    });
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select((keys[e.key] + tabs.length) % tabs.length, true);
      });
    });
    select(0);
  });

  // Right-hand TOC: scroll spy plus one marker that slides to the active section
  const tocLinks = $$(".toc-links a"), marker = $(".toc-marker");
  let markerPlaced = false;
  const moveMarker = (a) => {
    if (!marker || !a) return;
    // First placement happens without a transition so the marker does not slide in from the top on every page load.
    if (!markerPlaced) marker.style.transition = "none";
    marker.style.transform = `translateY(${a.offsetTop}px)`;
    marker.style.height = `${a.offsetHeight}px`;
    if (!markerPlaced) { void marker.offsetHeight; marker.style.transition = ""; markerPlaced = true; }
  };
  const activate = (id) => tocLinks.forEach((a) => {
    const on = a.getAttribute("href") === `#${id}`;
    a.classList.toggle("active", on);
    if (on) { a.setAttribute("aria-current", "location"); moveMarker(a); } else a.removeAttribute("aria-current");
  });
  const heads = tocLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
  if (heads.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e) => activate(e.target.id));
    }, { rootMargin: "-80px 0px -70% 0px" });
    heads.forEach((h) => io.observe(h));
    activate(heads[0].id);
  }

  // API status pill
  const status = $(".status");
  const setApi = (ok, text) => {
    status.classList.remove("ok", "down");
    status.classList.add(ok ? "ok" : "down");
    $("[data-status]", status).textContent = text;
    window.gzwRememberApi?.(ok, text);
  };
  fetch(`${API}/health`).then((r) => r.json()).then((j) => setApi(true, `API v${j.data.implementationVersion}`))
    .catch(() => setApi(false, "API unreachable"));

  // Live dataset counts and list
  const countEls = $$("[data-live-count]");
  const recordEls = $$("[data-live-records]");
  const grid = $("#ds-grid");
  if (countEls.length || recordEls.length || grid) {
    fetch(`${API}/stats`).then((r) => r.json()).then(({ data }) => {
      const names = Object.keys(data).sort();
      countEls.forEach((el) => countUp(el, names.length));
      recordEls.forEach((el) => countUp(el, names.reduce((s, n) => s + (data[n].total || 0), 0)));
      if (!grid) return;
      grid.textContent = "";
      names.forEach((n) => {
        const a = document.createElement("a");
        a.href = `${API}/${n}`; a.dataset.name = n;
        a.append(document.createTextNode(n));
        const b = document.createElement("b"); b.textContent = fmt(data[n].total);
        a.append(b);
        grid.append(a);
      });
      grid.classList.add("loaded");
      $("#ds-filter")?.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        $$("a", grid).forEach((a) => { a.hidden = !a.dataset.name.includes(q); });
      });
    }).catch(() => { if (grid) grid.textContent = "Could not load the live dataset list. Try again in a moment."; });
  }

  // Try-it box
  const tryBox = $(".try");
  if (tryBox) {
    const input = $("input", tryBox), out = $("pre", tryBox), note = $("[data-try-status]");
    const run = async () => {
      const path = input.value.trim().replace(/^\/+/, "");
      out.classList.remove("loaded");
      out.textContent = "Loading…";
      try {
        const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json" } });
        out.textContent = JSON.stringify(await res.json(), null, 2);
        note.textContent = `Response received, status ${res.status}.`;
      } catch (err) { out.textContent = `Request failed: ${err.message}. Check the path and try again.`; note.textContent = "Request failed."; }
      void out.offsetWidth;
      out.classList.add("loaded");
    };
    $("button", tryBox).addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    run();
  }

  // Hero terminal: types a request, then reveals the live response line by line
  const term = $("[data-terminal]");
  if (term) {
    const reqEl = $(".term-req", term), metaEl = $(".term-meta", term), bodyEl = $(".term-body", term), cursor = $(".cursor", term);
    const buttons = $$("[data-path]", term);
    let run = 0, auto = true, visible = true, current = 0;

    const compact = (json) => {
      const trim = (v) => typeof v === "string" && v.length > 44 ? `${v.slice(0, 43)}…` : v;
      const record = Array.isArray(json.data) ? json.data[0] : json.data;
      const shown = {};
      for (const [k, v] of Object.entries(record || {})) {
        if (k === "image" || k === "numeric_values" || v && typeof v === "object") continue;
        shown[k] = trim(v);
      }
      const out = { data: Array.isArray(json.data) ? [shown] : shown };
      if (json.total != null) out.total = json.total;
      out.dataVersion = json.dataVersion;
      const lines = JSON.stringify(out, null, 2).split("\n");
      return lines.length > 17 ? [...lines.slice(0, 16), "  …"] : lines;
    };

    const paint = (line) => {
      const row = document.createElement("span");
      const m = line.match(/^(\s*)("[^"]+")(: )?(.*)$/);
      const put = (cls, text) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; row.append(s); };
      if (m && m[3]) {
        put("", m[1]); put("tk", m[2]); put("tp", m[3]);
        const v = m[4];
        put(/^"/.test(v) ? "ts" : /^[\d-]/.test(v) ? "tn" : "tp", v);
      } else put("tp", line);
      row.append("\n");
      return row;
    };

    const play = async (i) => {
      const token = ++run; current = i;
      buttons.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
      const path = buttons[i].dataset.path, request = `GET /api/v1/${path}`;
      reqEl.textContent = ""; metaEl.textContent = ""; bodyEl.textContent = ""; cursor.hidden = false;
      const t0 = performance.now();
      const pending = fetch(`${API}/${path}`, { headers: { Accept: "application/json" } })
        .then(async (r) => ({ status: r.status, ok: r.ok, ms: Math.round(performance.now() - t0), json: await r.json() }))
        .catch(() => null);

      if (reduced.matches) reqEl.textContent = request;
      else for (let c = 1; c <= request.length && token === run; c++) { reqEl.textContent = request.slice(0, c); await sleep(c === 1 ? 250 : 22); }
      const result = await pending;
      if (token !== run) return;
      if (!result) { metaEl.textContent = "\nRequest failed. Check your connection and try again."; return; }
      metaEl.textContent = `\n${result.status} ${result.ok ? "OK" : "Error"}  ${result.ms} ms\n`;
      cursor.hidden = true;
      for (const line of compact(result.json)) {
        if (token !== run) return;
        bodyEl.append(paint(line));
        if (!reduced.matches) await sleep(34);
      }
      if (token !== run || reduced.matches) return;
      await sleep(5200);
      while (token === run && (!auto || !visible || document.hidden)) { if (!auto) return; await sleep(600); }
      if (token === run) play((i + 1) % buttons.length);
    };

    buttons.forEach((b, i) => b.addEventListener("click", () => { auto = false; play(i); }));
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(term);
    play(0);
  }

  // Search palette: accessible combobox over pages and sections
  const palette = $(".palette"), pInput = $(".palette input"), pList = $(".palette-list");
  const searchBtn = $(".search-btn");
  let index = [], sel = 0, opener = null;
  fetch("/assets/search-index.json").then((r) => r.json()).then((j) => { index = j; }).catch(() => {});
  if (/Mac|iPhone|iPad/.test(navigator.platform)) { const k = $(".search-btn kbd"); if (k) k.textContent = "⌘K"; }

  const setSel = (i) => {
    const items = $$('[role="option"]', pList);
    if (!items.length) { pInput.removeAttribute("aria-activedescendant"); return; }
    sel = (i + items.length) % items.length;
    items.forEach((el, j) => el.setAttribute("aria-selected", String(j === sel)));
    pInput.setAttribute("aria-activedescendant", items[sel].id);
    items[sel].scrollIntoView({ block: "nearest" });
  };
  const render = () => {
    const q = pInput.value.trim().toLowerCase();
    const shown = index.filter((e) => !q || `${e.title} ${e.section}`.toLowerCase().includes(q)).slice(0, 30);
    pList.textContent = "";
    if (!shown.length) {
      const p = document.createElement("p"); p.className = "palette-empty"; p.textContent = `No results for “${pInput.value}”. Try a dataset or endpoint name.`;
      pList.append(p);
    }
    shown.forEach((e, i) => {
      const a = document.createElement("a");
      a.href = e.url; a.id = `opt-${i}`; a.setAttribute("role", "option"); a.tabIndex = -1;
      a.append(document.createTextNode(e.title));
      const s = document.createElement("small"); s.textContent = e.section; a.append(s);
      pList.append(a);
    });
    pInput.setAttribute("aria-expanded", String(shown.length > 0));
    setSel(0);
  };
  const openPalette = () => {
    opener = document.activeElement;
    palette.classList.add("open");
    document.body.style.overflow = "hidden";
    pInput.value = ""; render(); pInput.focus();
  };
  const closePalette = () => {
    if (!palette.classList.contains("open")) return;
    palette.classList.remove("open");
    document.body.style.overflow = "";
    (opener || searchBtn)?.focus();
  };
  searchBtn?.addEventListener("click", openPalette);
  palette?.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });
  pInput?.addEventListener("input", render);
  pInput?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(sel - 1); }
    else if (e.key === "Enter") { const item = $$('[role="option"]', pList)[sel]; if (item) location.href = item.href; }
    else if (e.key === "Tab") e.preventDefault();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    else if (e.key === "Escape") { closePalette(); if (sidebar.classList.contains("open")) setMenu(false); }
    else if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
  });

  // Footer year
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // Theme switch: a stored choice wins, otherwise the system setting (see theme.js)
  const themeBtn = $(".theme-btn");
  const applyTheme = (theme, persist) => {
    document.documentElement.dataset.theme = theme;
    themeBtn?.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} theme`);
    $('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f5f7f5" : "#0a0c0e");
    if (persist) { try { localStorage.setItem("gzw-theme", theme); } catch { /* storage unavailable */ } }
  };
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);
  themeBtn?.addEventListener("click", () => {
    const root = document.documentElement;
    if (!reduced.matches) { root.classList.add("theme-anim"); setTimeout(() => root.classList.remove("theme-anim"), 350); }
    applyTheme(root.dataset.theme === "light" ? "dark" : "light", true);
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    let stored = null;
    try { stored = localStorage.getItem("gzw-theme"); } catch { /* ignore */ }
    if (!stored) applyTheme(e.matches ? "light" : "dark", false);
  });
})();
