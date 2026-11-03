// Runs in <head> before first paint so the page never flashes the wrong theme.
(() => {
  let theme = null;
  try { theme = localStorage.getItem("gzw-theme"); } catch { /* storage unavailable */ }
  if (theme !== "light" && theme !== "dark") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
})();
