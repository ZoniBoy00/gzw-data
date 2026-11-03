// Runs synchronously before first paint so page-to-page navigation does not flicker:
// the sidebar keeps its scroll position and the API pill shows the last known state.
(() => {
  const KEY = "gzw-demo-nav";
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (patch) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* storage unavailable */ } };
  const saved = read();

  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    if (typeof saved.side === "number") sidebar.scrollTop = saved.side;
    const link = sidebar.querySelector("a.active");
    if (link) {
      const top = link.offsetTop, bottom = top + link.offsetHeight;
      if (top < sidebar.scrollTop || bottom > sidebar.scrollTop + sidebar.clientHeight) {
        sidebar.scrollTop = Math.max(0, top - sidebar.clientHeight / 2);
      }
    }
    const remember = () => write({ side: sidebar.scrollTop });
    sidebar.addEventListener("scroll", remember, { passive: true });
    addEventListener("pagehide", remember);
  }

  const pill = document.querySelector(".status");
  const label = pill?.querySelector("[data-status]");
  if (pill && label && saved.api) {
    pill.classList.add(saved.api.ok ? "ok" : "down");
    label.textContent = saved.api.text;
  }
  window.gzwRememberApi = (ok, text) => write({ api: { ok, text } });
})();
