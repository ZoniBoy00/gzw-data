(() => {
  const path = window.location.pathname;
  const shown = document.getElementById("missing-path");
  if (shown) shown.textContent = path.length > 60 ? `${path.slice(0, 57)}…` : path;

  // API status pill (same check as the console).
  const pill = document.getElementById("api-status");
  fetch("/api/v1/health", { headers: { Accept: "application/json" } })
    .then((response) => { if (!response.ok) throw new Error(); pill.lastElementChild.textContent = "API online"; })
    .catch(() => { pill.lastElementChild.textContent = "API unreachable"; });

  const pages = [
    ["/", "Overview"], ["/docs/", "API reference"], ["/docs/sdk/", "JavaScript SDK guide"], ["/docs/examples/", "API and SDK examples"],
    ["/playground/", "API Playground"], ["/feedback/", "Feedback desk"], ["/privacy-policy/", "Privacy Policy"], ["/terms-of-service/", "Terms of Service"],
  ];

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

  const lastSegment = (value) => value.replace(/\/+$/, "").split("/").pop().toLowerCase();
  const wanted = lastSegment(path);

  function render(candidates) {
    if (!wanted) return;
    const matches = candidates
      .map(([href, label]) => ({ href, score: Math.min(distance(wanted, lastSegment(href)), distance(wanted, label.toLowerCase())) }))
      .filter((item) => item.score <= Math.max(2, Math.floor(wanted.length / 3)))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    if (!matches.length) return;
    const list = document.getElementById("suggestion-list");
    list.replaceChildren(...matches.map((item) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.href;
      li.append(link);
      return li;
    }));
    document.getElementById("suggestions").hidden = false;
  }

  render(pages);
  // A mistyped dataset name is the most likely miss, so offer the real endpoints too.
  fetch("/api/v1/stats", { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("stats"))))
    .then((payload) => render([...pages, ...Object.keys(payload.data || payload).map((name) => [`/api/v1/${name}`, name])]))
    .catch(() => {});
})();
