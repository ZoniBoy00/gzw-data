// Keeps published client versions current without a site deploy. Each [data-pkg-version="npm|pypi"]
// element ships with a static fallback and is replaced by the registry's latest release when it loads.
const SOURCES = {
  npm: { url: "https://registry.npmjs.org/@zoniboy%2Fgzw-data-client/latest", read: (data) => data.version },
  pypi: { url: "https://pypi.org/pypi/gzw-data/json", read: (data) => data.info && data.info.version },
};
const MAX_AGE_MS = 60 * 60 * 1000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function cached(registry) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(`gzw-version-${registry}`));
    if (entry && Date.now() - entry.at < MAX_AGE_MS && VERSION_PATTERN.test(entry.version)) return entry.version;
  } catch { /* storage unavailable or unreadable */ }
  return null;
}

async function latest(registry) {
  const known = cached(registry);
  if (known) return known;
  const source = SOURCES[registry];
  const response = await fetch(source.url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const version = source.read(await response.json());
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) throw new Error("Unexpected version");
  try { sessionStorage.setItem(`gzw-version-${registry}`, JSON.stringify({ version, at: Date.now() })); } catch { /* ignore */ }
  return version;
}

const registries = new Set([...document.querySelectorAll("[data-pkg-version]")].map((el) => el.dataset.pkgVersion));
registries.forEach((registry) => {
  if (!SOURCES[registry]) return;
  latest(registry)
    .then((version) => {
      document.querySelectorAll(`[data-pkg-version="${registry}"]`).forEach((el) => { el.textContent = version; });
    })
    .catch(() => { /* keep the static fallback */ });
});
