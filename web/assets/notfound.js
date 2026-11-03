// 404 page: show the missing path and suggest the closest real pages and datasets.
(() => {
  const path = window.location.pathname;
  const shown = document.getElementById("missing-path");
  if (shown) shown.textContent = path.length > 60 ? `${path.slice(0, 57)}…` : path;

  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const lastSegment = (value) => value.replace(/[#?].*$/, "").replace(/\/+$/, "").split("/").pop().toLowerCase();
  const wanted = lastSegment(path);
  const pool = new Map();

  function render(candidates) {
    if (!wanted) return;
    candidates.forEach(({ url, title }) => pool.set(url, Math.min(distance(wanted, lastSegment(url)), distance(wanted, title.toLowerCase()))));
    const matches = [...pool.entries()]
      .map(([url, score]) => ({ url, score }))
      .filter((m) => m.score <= Math.max(2, Math.floor(wanted.length / 3)))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    if (!matches.length) return;
    const list = document.getElementById("suggestion-list");
    list.replaceChildren(...matches.map((m) => {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = m.url; a.textContent = m.url; li.append(a);
      return li;
    }));
    document.getElementById("suggestions").hidden = false;
  }

  fetch("/assets/search-index.json").then((r) => r.json())
    .then((index) => render(index.filter((e) => !e.url.includes("#") && !e.url.startsWith("http")).map((e) => ({ url: e.url, title: e.title }))))
    .catch(() => {});
  // A mistyped dataset name is the most likely miss, so offer the real endpoints too.
  fetch("/api/v1/stats", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
    .then((payload) => render(Object.keys(payload.data || payload).map((name) => ({ url: `/api/v1/${name}`, title: name }))))
    .catch(() => {});
})();
