// Content for the docs site. Bodies are plain HTML; helpers keep code blocks, tabs and callouts consistent.
// Internal links are written as "~/path/" and resolved by scripts/build-demo.js.
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://gzw-data.dev/api/v1';
const GH = 'https://github.com/ZoniBoy00/gzw-data';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (text, label = '') => `<div class="code">${label ? `<span class="label">${label}</span>` : ''}<pre><code>${esc(text.trim())}</code></pre></div>`;
let tabId = 0;
const tabs = items => {
  const id = `t${++tabId}`;
  return `<div class="tabset"><div class="tab-list" role="tablist">${items.map((t, i) =>
    `<button type="button" role="tab" id="${id}-${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}"${i === 0 ? '' : ' tabindex="-1"'}>${t.name}</button>`).join('')}</div>${items.map((t, i) =>
    `<div role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-${i}"${i === 0 ? '' : ' hidden'}>${code(t.code)}</div>`).join('')}</div>`;
};
const CALLOUT_ICON = { note: 'info', tip: 'lightbulb', warn: 'triangle-alert' };
const callout = (kind, title, html) => `<div class="callout ${kind}"><strong class="title">{{i:${CALLOUT_ICON[kind]}}} ${title}</strong>${html}</div>`;
const SLUG_ICON = { quickstart: 'rocket', datasets: 'database', querying: 'filter', records: 'file-json', responses: 'braces', limits: 'gauge', examples: 'book-open', clients: 'package', sdk: 'square-terminal', python: 'terminal', playground: 'flask-conical', explorer: 'compass', status: 'activity', 'data-sources': 'scale', feedback: 'message-square', privacy: 'shield', terms: 'file-text' };
const routeIcon = r => r.icon || SLUG_ICON[r.href.replace(/^~\//, '').replace(/\/$/, '')] || 'arrow-right';
const routes = items => `<ul class="routes">${items.map(r =>
  `<li><a href="${r.href}"${r.ext ? ' target="_blank" rel="noopener noreferrer"' : ''}><strong>{{i:${routeIcon(r)}}}${r.title}</strong><span>${r.text}</span><i aria-hidden="true">{{i:${r.ext || r.href.startsWith('mailto') ? 'external-link' : 'arrow-right'}}}</i></a></li>`).join('')}</ul>`;

const requestTabs = (p, jsExtra = '') => tabs([
  { name: 'cURL', code: `curl "${BASE}/${p}"` },
  { name: 'JavaScript', code: `const res = await fetch("${BASE}/${p}");\nconst { data } = await res.json();${jsExtra}` },
  { name: 'Python', code: `import requests\n\ndata = requests.get("${BASE}/${p}").json()["data"]` },
]);

// The legal pages stay the single source of truth: reuse their text instead of copying it.
function legal(dir) {
  const html = fs.readFileSync(path.join(__dirname, 'legal', `${dir}.html`), 'utf8');
  const start = html.indexOf('<main class="page">') + '<main class="page">'.length;
  return html.slice(start, html.indexOf('<footer class="site-footer">'))
    .replace(/<h1>.*?<\/h1>/s, '')
    .replace(/<div class="updated">(.*?)<\/div>/s, '<p class="lead">$1</p>')
    .replace(/<div class="notice">\s*<p>(.*?)<\/p>\s*<\/div>/s, (_m, t) => callout('note', 'In short', `<p>${t}</p>`));
}

const pages = [
  {
    slug: '', icon: 'house', group: 'Getting started', nav: 'Introduction', tab: 'Docs', hero: true,
    title: 'Gray Zone Warfare API', seoTitle: 'Gray Zone Warfare API · Weapons, Missions & Game Data', keywords: 'Gray Zone Warfare API, GZW API, Gray Zone Warfare weapons API, missions API, loot API, game data API', desc: 'Free Gray Zone Warfare API with auto-discovered weapons, missions, loot, armor and more. OpenAPI docs, no API key, and a JavaScript/TypeScript client.',
    body: `
<section class="hero" aria-labelledby="page-title">
  <h1 id="page-title">Gray Zone Warfare data, one GET away.</h1>
  <p class="lead">Weapons, missions, loot, armor and more as free, read-only JSON. No account and no API key, and 100 requests a minute is plenty for a bot, a dashboard or a loadout tool.</p>
  <div class="actions"><a class="btn primary" href="~/quickstart/">{{i:rocket}} Make your first request</a><a class="btn" href="~/datasets/">{{i:database}} Browse datasets</a><a class="btn" href="/api/v1/spec">{{i:file-json}} OpenAPI spec</a></div>
  <div class="terminal" data-terminal>
    <div class="term-bar">
      <div class="term-tabs" role="group" aria-label="Example requests">
        <button type="button" data-path="weapons/ak-12" aria-pressed="true">Weapon</button>
        <button type="button" data-path="keys?type=Keycard&per_page=1" aria-pressed="false">Keycard</button>
        <button type="button" data-path="tasks?per_page=1" aria-pressed="false">Task</button>
      </div>
      <span class="term-state">live from the API</span>
    </div>
    <p class="sr-only">Animated example: a GET request to the API returns one JSON record.</p>
    <pre class="term-out" aria-hidden="true"><code><span class="term-req"></span><span class="cursor"></span><span class="term-meta"></span><span class="term-body"></span></code></pre>
    <div class="term-foot"><span><b data-live-count>0</b>datasets</span><span><b data-live-records>0</b>records</span><span><b>Weekly</b>data updates</span><span><b>No</b>API key</span></div>
  </div>
</section>
<h2>Try it yourself</h2>
<p>Edit the path and press Enter. This calls the live API. For a fuller request builder, open the <a href="~/playground/">Playground</a>.</p>
<div class="try"><div class="try-bar"><span class="method">GET</span><input type="text" value="weapons?per_page=1" name="path" aria-label="API path" spellcheck="false"><button class="btn" type="button">Send request</button></div><pre aria-label="Response" tabindex="0"></pre><p class="sr-only" role="status" data-try-status></p></div>
<h2>Where to go next</h2>
${routes([
  { href: '~/quickstart/', title: 'Quick start', text: 'Your first request in cURL, JavaScript or Python.' },
  { href: '~/datasets/', title: 'Datasets', text: 'Every dataset with live record counts.' },
  { href: '~/querying/', title: 'Filters and search', text: 'Filter, search, sort and paginate any dataset.' },
  { href: '~/clients/', title: 'Client libraries', text: 'Typed npm and PyPI clients with retries built in.' },
  { href: '~/playground/', title: 'Playground', text: 'Build a request and inspect the response.' },
  { href: '~/data-sources/', title: 'Data and licensing', text: 'Where the data comes from and how to credit it.' },
])}
<h2>What you can rely on</h2>
<ul class="points">
  <li>{{i:boxes}}<div><strong>Auto-discovered datasets</strong><p>Every JSON file in the data repository becomes an endpoint. New wiki categories appear without route code.</p></div></li>
  <li>{{i:braces}}<div><strong>A stable response contract</strong><p>One envelope for every dataset, stable error codes, pagination, filters and sorting. Breaking changes need a new API line.</p></div></li>
  <li>{{i:refresh-cw}}<div><strong>Reviewed weekly updates</strong><p>A scraper refreshes the data every week and opens a pull request, so changes are reviewed and a drop guard blocks accidental data loss. Data routes use a 300 second CDN cache window.</p></div></li>
  <li>{{i:scroll-text}}<div><strong>Transparent provenance</strong><p>Data comes from the community wiki under CC BY-SA. Licensing, sources and revision hints are documented in <a href="~/data-sources/">Data sources</a>.</p></div></li>
</ul>
<h2>Need help or found a problem?</h2>
<p>Use the <a href="~/feedback/">feedback page</a> for data corrections, feature requests and API questions. Check the live <a href="~/status/">data status</a> if something looks stale.</p>
${callout('note', 'Fan-made project', '<p>GZW Data is community-run and not affiliated with MADFINGER Games. Data comes from the community wiki and can be incomplete or outdated.</p>')}
`,
  },
  {
    slug: 'quickstart', icon: 'rocket', group: 'Getting started', nav: 'Quick start', tab: 'Docs',
    title: 'Quick start', desc: 'Make your first GZW Data API request in cURL, JavaScript or Python.',
    body: `
<p class="lead">All routes are read-only and return JSON. Use <code>/api/v1</code> for new integrations.</p>
<h2 data-alias="quickstart">1. List a dataset</h2>
${requestTabs('weapons?per_page=5')}
<h2 data-alias="single-record">2. Fetch one record</h2>
<p>Records are addressed by canonical ID. Reviewed legacy IDs resolve to the same record.</p>
${requestTabs('weapons/ak-12')}
<h2 data-alias="responses">3. Read the response</h2>
<p>Every successful response carries <code>data</code>, <code>source</code>, <code>timestamp</code> and <code>dataVersion</code>. See <a href="~/responses/">Response format</a>.</p>
${code(`{
  "data": { "name": "AK-12", "id": "ak-12", "type": "Assault Rifle", "caliber": "5.45x39mm" },
  "source": "GZW Data API",
  "timestamp": "2026-11-03T10:04:10.944Z",
  "dataVersion": "2026-11-02T16:13:19.465474Z"
}`, 'example response')}
<h2>Next steps</h2>
<ul>
  <li>Narrow results with <a href="~/querying/">filters, search and pagination</a>.</li>
  <li>Skip hand-written fetch code with a <a href="~/clients/">client library</a>.</li>
  <li>Copy more recipes from <a href="~/examples/">Examples</a>, or build a request in the <a href="~/playground/">Playground</a>.</li>
  <li>Check the <a href="~/limits/">rate limit and caching</a> rules before shipping.</li>
</ul>
${callout('tip', 'Tip', '<p>The dataset list grows automatically as the scraper discovers new categories. Discover datasets at runtime from <code>GET /api/v1</code> instead of hard-coding them.</p>')}
`,
  },
  {
    slug: 'datasets', icon: 'database', group: 'API reference', nav: 'Datasets', tab: 'API reference',
    title: 'Datasets', desc: 'Every GZW Data dataset with live record counts.',
    body: `
<p class="lead"><strong data-live-count>—</strong> datasets are exposed. The list below is loaded from the live API, so new categories appear without a docs update.</p>
<h2>Routes for every dataset</h2>
<table><thead><tr><th>Route</th><th>Returns</th></tr></thead><tbody>
<tr><td><code>GET /api/v1/{dataset}</code></td><td>Paginated records</td></tr>
<tr><td><code>GET /api/v1/{dataset}/{id}</code></td><td>One record</td></tr>
<tr><td><code>GET /api/v1/metadata/{dataset}</code></td><td>Observed fields, types and an example value</td></tr>
<tr><td><code>GET /api/v1/schema/{dataset}</code></td><td>Machine-readable schema for code generators</td></tr>
<tr><td><code>GET /api/v1/items/{id}/context</code></td><td>References to an item across datasets</td></tr>
<tr><td><code>GET /api/v1/version</code>, <code>/changes</code></td><td>API and data snapshot information</td></tr>
</tbody></table>
${callout('note', 'Context routes', '<p>References come from the current dataset contents and are not guaranteed gameplay relationships.</p>')}
<h2>All datasets</h2>
<input class="filter" id="ds-filter" name="filter" type="search" placeholder="Filter datasets…" aria-label="Filter datasets">
<div class="ds-grid" id="ds-grid"><span class="muted">Loading…</span></div>
`,
  },
  {
    // One shared template served for /datasets/{name}/ (see vercel.json). dataset.js fills it from the live API,
    // so a dataset the scraper just discovered has a docs page without any rebuild.
    slug: 'dataset', hidden: true, icon: 'database', group: 'API reference', nav: 'Dataset', tab: 'API reference', scripts: ['dataset.js'],
    title: 'Dataset', desc: 'Fields, types, filters and example requests for a GZW Data dataset.',
    body: `
<noscript><p>This page needs JavaScript to load the dataset description. The same information is available from <code>${BASE}/metadata/{dataset}</code>.</p></noscript>
<div data-dataset-page>
  <p class="lead" data-ds-lead>Loading dataset…</p>
  <div class="callout warn" data-ds-error hidden><strong class="title">{{i:triangle-alert}} Dataset not found</strong><p data-ds-error-text></p><p><a href="~/datasets/">Browse all datasets</a></p></div>
  <div data-ds-content hidden>
    <dl class="kv">
      <div><dt>Records</dt><dd data-ds-kv="records">…</dd></div>
      <div><dt>Fields</dt><dd data-ds-kv="fields">…</dd></div>
      <div><dt>Last scraped</dt><dd data-ds-kv="scraped">…</dd></div>
      <div><dt>Source file</dt><dd data-ds-kv="file">…</dd></div>
    </dl>
    <h2 data-id="endpoints">Endpoints</h2>
    <div class="ex-table-wrap"><table class="ex-table"><thead><tr><th scope="col">Route</th><th scope="col">Returns</th></tr></thead><tbody data-ds-endpoints></tbody></table></div>
    <h2 data-id="example">Example request</h2>
    <div class="code"><span class="label">cURL</span><pre><code data-ds-curl></code></pre></div>
    <div class="code"><span class="label">JavaScript</span><pre><code data-ds-js></code></pre></div>
    <h2 data-id="fields">Fields</h2>
    <p class="muted">Observed from the current data. <strong>Optional</strong> fields are missing from some records; the coverage column shows how many records have the field.</p>
    <div class="ex-table-wrap"><table class="ex-table"><thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Coverage</th><th scope="col">Example</th></tr></thead><tbody data-ds-fields></tbody></table></div>
    <h2 data-id="filters">Filters</h2>
    <p data-ds-filters-lead></p>
    <ul data-ds-filters></ul>
    <p>See <a href="~/querying/">Filters, search &amp; pagination</a> for sorting and paging, or try this dataset in the <a data-ds-explorer href="~/explorer/">data explorer</a>.</p>
  </div>
</div>
`,
  },
  {
    slug: 'querying', icon: 'filter', group: 'API reference', nav: 'Filters, search & pagination', tab: 'API reference',
    title: 'Filters, search & pagination', desc: 'Query any GZW Data dataset with composable filter, search, sort and pagination parameters.',
    body: `
<p class="lead">Every dataset accepts the same small set of query parameters. They can be combined freely.</p>
<h2>Parameters</h2>
<table><thead><tr><th>Parameter</th><th>Description</th></tr></thead><tbody>
<tr><td><code>?field=value</code></td><td>Filter by any string field, for example <code>?type=Keycard</code></td></tr>
<tr><td><code>?search=ak</code></td><td>Full-text search across the record fields</td></tr>
<tr><td><code>?sort=name:asc</code></td><td>Sort by a field, <code>asc</code> or <code>desc</code></td></tr>
<tr><td><code>?page=2&amp;per_page=20</code></td><td>Paginate. <code>per_page</code> defaults to 50 and caps at 500</td></tr>
<tr><td><code>?dataset=weapons</code></td><td>Limit search to one or more comma-separated datasets</td></tr>
<tr><td><code>?fields=name,type</code></td><td>Search only selected comma-separated fields</td></tr>
<tr><td><code>?fuzzy=true</code></td><td>Tolerate small spelling differences. Needs 1–3 explicit datasets</td></tr>
<tr><td><code>?limit=10</code></td><td>Limit matches per dataset in search. Maximum 50</td></tr>
</tbody></table>
<h2>Combine them</h2>
${requestTabs('keys?type=Keycard&search=alpha&page=1&per_page=20')}
<h2>Search across datasets</h2>
${code(`curl "${BASE}/search?q=AK&dataset=weapons&limit=5"`)}
<h2>Numeric values</h2>
<p>Records may include an additive <code>numeric_values</code> object for unambiguous unit-bearing fields. Original source strings are always kept.</p>
${code(`"weight": "3.553 kg",
"numeric_values": { "weight": { "value": 3.553, "unit": "kg" } }`, 'weapons/ak-12 (excerpt)')}
`,
  },
  {
    slug: 'records', icon: 'file-json', group: 'API reference', nav: 'Records & metadata', tab: 'API reference',
    title: 'Records & metadata', desc: 'Fetch one record, inspect dataset metadata and schema, follow item context and read version and change history.',
    body: `
<p class="lead">Besides listing a dataset, the API can return one record, describe a dataset's fields and report what changed between data snapshots.</p>
<h2>Get one record</h2>
<p>Records are addressed by canonical ID. A reviewed legacy ID may also resolve to the same canonical record.</p>
${code(`curl ${BASE}/weapons/ak-12`)}
<p>The JavaScript client exposes the same route through <code>dataset.get(id)</code>.</p>
${callout('note', 'IDs and numbers', '<p>Reviewed legacy IDs resolve to the canonical record ID. Records may also include an additive <code>numeric_values</code> object for unit-bearing fields. Original source strings are retained.</p>')}
<h2>Dataset metadata and schema</h2>
<p>Inspect generated field metadata without downloading a full dataset.</p>
${code(`curl ${BASE}/metadata/weapons
curl ${BASE}/schema/weapons`)}
<p>Metadata returns the item count, observed fields, detected types, optional or nullable flags, a stable example value, the last scrape time and the wiki pages each dataset came from. Use <code>/api/v1/schema/{dataset}</code> when a code generator or validator needs one machine-readable schema.</p>
<h2>Context routes</h2>
<p>Use related routes to combine datasets without guessing relationships. The item context endpoint reports dataset references found in the current data.</p>
${code(`curl ${BASE}/items/advanced-tracking-tag/context`)}
${callout('note', 'Not gameplay facts', '<p>References are based on the current dataset contents and are not guaranteed gameplay relationships.</p>')}
<h2>Version and change history</h2>
<p>Inspect the API version, current data snapshot, dataset count and canonical integration links without loading a dataset.</p>
${code(`curl ${BASE}/version
curl ${BASE}/changes`)}
<p><code>changes</code> compares dataset counts with the latest stored snapshot. The first snapshot reports no changes until a second one exists. The <a href="~/status/">data status</a> page shows the same information live.</p>
`,
  },
  {
    slug: 'responses', icon: 'braces', group: 'API reference', nav: 'Response format', tab: 'API reference',
    title: 'Response format', desc: 'Envelope, pagination fields and error shape used by every GZW Data API route.',
    body: `
<p class="lead">All routes share one envelope, so a single parser covers the whole API.</p>
<h2>Success envelope</h2>
<p>Paginated routes add <code>count</code>, <code>page</code>, <code>perPage</code>, <code>total</code> and <code>totalPages</code>. Single-record routes return an object in <code>data</code>, not an array.</p>
${code(`{
  "data": [ ... ],
  "count": 10,
  "page": 1,
  "perPage": 50,
  "total": 2141,
  "totalPages": 43,
  "source": "GZW Data API",
  "timestamp": "2026-09-20T08:00:00.000Z",
  "dataVersion": "2026-09-14T13:05:54.486874Z"
}`)}
${callout('note', 'Timestamps', '<p><code>timestamp</code> is the response time. <code>dataVersion</code> identifies the data snapshot. Example counts above are illustrative.</p>')}
<h2>Error envelope</h2>
<p>HTTP errors share a stable shape: <code>error.code</code>, <code>error.message</code>, optional route details, plus <code>source</code>, <code>timestamp</code> and <code>dataVersion</code>.</p>
<table><thead><tr><th>Code</th><th>Meaning</th></tr></thead><tbody>
<tr><td><code>DATASET_NOT_FOUND</code></td><td>Unknown dataset name</td></tr>
<tr><td><code>RECORD_NOT_FOUND</code></td><td>No record with that ID</td></tr>
<tr><td><code>METHOD_NOT_ALLOWED</code></td><td>The API is read-only; use GET</td></tr>
<tr><td><code>RATE_LIMITED</code></td><td>Too many requests. See <a href="~/limits/">limits</a></td></tr>
<tr><td><code>INTERNAL_ERROR</code></td><td>Unexpected server error</td></tr>
</tbody></table>
<p>The full contract lives in <a href="${GH}/blob/main/docs/API_CONTRACT.md">API_CONTRACT.md</a> and the <a href="/api/v1/spec">OpenAPI document</a>.</p>
`,
  },
  {
    slug: 'limits', icon: 'gauge', group: 'API reference', nav: 'Rate limits & caching', tab: 'API reference',
    title: 'Rate limits & caching', desc: 'Request limits, rate-limit headers and cache behaviour of the GZW Data API.',
    body: `
<p class="lead">The API is free and best-effort. Cache on your side and respect the retry delay.</p>
<h2>Rate limit</h2>
<p><strong>100 requests per minute per IP</strong>, as a sliding window. The counter lives in the memory of each warm Vercel function instance, so it is not a strict global quota.</p>
<table><thead><tr><th>Header</th><th>Meaning</th></tr></thead><tbody>
<tr><td><code>X-RateLimit-Limit</code></td><td>Requests allowed in the window</td></tr>
<tr><td><code>X-RateLimit-Remaining</code></td><td>Requests left in the window</td></tr>
<tr><td><code>X-RateLimit-Reset</code></td><td>When the window resets</td></tr>
<tr><td><code>Retry-After</code></td><td>Seconds to wait after a <code>429</code></td></tr>
</tbody></table>
<h2>Caching</h2>
<p>Data endpoints send <code>Cache-Control: public, max-age=300</code>. The wiki-backed data is refreshed by the scraper, so caching for a few minutes loses nothing. Newly scraped data may take a short while to pass through the CDN.</p>
${callout('warn', 'Be a good client', '<p>Do not proxy or hammer the API to bypass limits. Bots and dashboards should cache responses and use <code>dataVersion</code> to detect changes.</p>')}
`,
  },
  {
    slug: 'examples', icon: 'book-open', group: 'Guides', nav: 'Examples', tab: 'Docs',
    title: 'Examples', desc: 'Copyable cURL, JavaScript, TypeScript SDK and Python requests for the GZW Data API.',
    body: `
<p class="lead">Every example uses the public, read-only v1 API. Use plain HTTP from any language, or a client library for typed helpers.</p>
<h2 data-alias="rest">List a page</h2>
${code(`curl -sS "${BASE}/weapons?page=1&per_page=5"`)}
<p>REST uses <code>per_page</code>. The JavaScript SDK uses the equivalent camelCase option <code>perPage</code>.</p>
<h2>Fetch one record by ID</h2>
${code(`curl -sS ${BASE}/weapons/ak-12`)}
<h2 data-alias="discover">Search and inspect metadata</h2>
${code(`curl -sS "${BASE}/search?q=AK&dataset=weapons&limit=5"
curl -sS "${BASE}/metadata?full=true"`)}
<h2 data-id="sdk">Use the SDK for typed helpers</h2>
<p>Install <code>@zoniboy/gzw-data-client</code> in Node.js 22+ or a modern browser app. It has no runtime dependencies and needs no API key. Details are in the <a href="~/sdk/">SDK guide</a>.</p>
${code('npm install @zoniboy/gzw-data-client')}
${code(`import { GzwDataClient } from "@zoniboy/gzw-data-client";

const gzw = new GzwDataClient();
const page = await gzw.dataset("weapons").list({ page: 1, perPage: 5 });
console.log(page.data);
console.log(page.total);`)}
<h2>Build a live dataset picker</h2>
<p>Read names from the API registry at runtime. New datasets and fields work without updating the npm package.</p>
${code(`const registry = await gzw.metadata();
const datasetNames = registry.datasets.map(({ name }) => name);
const selectedName: string = datasetNames[0] ?? "weapons";
const resource = gzw.dataset(selectedName);
const info = await resource.info();
const firstPage = await resource.list({ page: 1, perPage: 20 });`)}
<h2 data-alias="browser">Fetch from a browser app</h2>
<p>For a small prototype, call the REST endpoint with standard <code>fetch</code>. Check <code>response.ok</code> before treating the body as a success.</p>
${code(`const params = new URLSearchParams({ page: "1", per_page: "5" });
const response = await fetch(
  \`${BASE}/weapons?\${params}\`,
  { headers: { Accept: "application/json" } },
);
if (!response.ok) throw new Error(\`GZW Data API: HTTP \${response.status}\`);
const payload = await response.json();
console.log(payload.data);`)}
<h2>Python</h2>
<p>The client handles pagination, retries and errors. See the <a href="~/python/">Python guide</a>.</p>
${code(`pip install gzw-data

from gzw_data import GzwDataClient

client = GzwDataClient()
for gun in client.iterate("weapons", search="AK"):
    print(gun["name"], gun["caliber"])`)}
<p>Prefer plain HTTP? Pass query values separately instead of building an encoded URL by hand.</p>
${code(`import requests

response = requests.get(
    "${BASE}/search",
    params={"q": "AK", "dataset": "weapons", "limit": 5},
    timeout=10,
)
response.raise_for_status()
print(response.json()["data"])`)}
`,
  },
  {
    slug: 'clients', icon: 'package', group: 'Clients', nav: 'Overview', tab: 'Clients',
    title: 'Client libraries', desc: 'Official zero-dependency JavaScript/TypeScript and Python clients for the GZW Data API.',
    body: `
<p class="lead">Both clients handle pagination, retries and typed errors. New datasets work without a package update, because dataset names come from the live API.</p>
${routes([
  { href: '~/sdk/', title: 'JavaScript and TypeScript', text: 'Typed client for Node.js 22+ and modern browsers. No dependencies.' },
  { href: '~/python/', title: 'Python', text: 'Standard-library-only client for Python 3.9+.' },
])}
<h2>At a glance</h2>
<table><thead><tr><th></th><th>JavaScript / TypeScript</th><th>Python</th></tr></thead><tbody>
<tr><td>Install</td><td><code>npm install @zoniboy/gzw-data-client</code></td><td><code>pip install gzw-data</code></td></tr>
<tr><td>Latest release</td><td><code data-pkg-version="npm">0.9.0</code></td><td><code data-pkg-version="pypi">0.2.0</code></td></tr>
<tr><td>Runtime</td><td>Node.js 22+, modern browsers</td><td>Python 3.9+</td></tr>
<tr><td>Dependencies</td><td>None</td><td>None</td></tr>
</tbody></table>
${callout('note', 'Older Node.js', '<p>Client 0.9.0 needs Node.js 22+. Version 0.7.3 is the last release that supports Node.js 18+.</p>')}
`,
  },
  {
    slug: 'sdk', icon: 'square-terminal', group: 'Clients', nav: 'JavaScript & TypeScript', tab: 'Clients',
    title: 'JavaScript & TypeScript SDK', desc: 'Install and use the official zero-dependency JavaScript and TypeScript client for the GZW Data API.',
    body: `
<p class="lead">A small, typed client for Node.js 22+ and modern browsers. It handles dataset requests, pagination, retries and typed errors without a runtime dependency.</p>
<p><a href="https://www.npmjs.com/package/@zoniboy/gzw-data-client" target="_blank" rel="noopener noreferrer">@zoniboy/gzw-data-client on npm ↗</a>, latest release <code data-pkg-version="npm">0.9.0</code>.</p>
${callout('note', 'Datasets come from the live API', '<p>The generated TypeScript autocomplete list is only a snapshot. New API datasets stay usable without an npm update.</p>')}
<h2 data-alias="quickstart">Install and fetch a page</h2>
${code('npm install @zoniboy/gzw-data-client')}
${code(`import { GzwDataClient } from "@zoniboy/gzw-data-client";

const gzw = new GzwDataClient();
const page = await gzw.dataset("weapons").list({
  page: 1,
  perPage: 20,
});
console.log(page.data);
console.log(page.total);`)}
<p>The SDK uses camelCase options such as <code>perPage</code>. Direct REST requests use the API's query spelling, <code>per_page</code>.</p>
<h2 data-alias="discover">Discover datasets at runtime</h2>
<p>Use <code>metadata()</code> when an application needs the current dataset names. Newly added datasets can be passed to <code>dataset(name)</code> immediately.</p>
${code(`const registry = await gzw.metadata();
const datasetNames = registry.datasets.map((dataset) => dataset.name);
const selectedName: string = datasetNames[0] ?? "weapons";
const selectedDataset = gzw.dataset(selectedName);
const info = await selectedDataset.info();
const records = await selectedDataset.list({ page: 1, perPage: 20 });`)}
<p>For a newly discovered dataset, TypeScript uses the generic <code>GzwRecord</code> fallback: fields stay accessible, but fields without a curated model have type <code>unknown</code>.</p>
<h2 data-alias="operations">List, filter, search and fetch</h2>
<p>Each dataset resource provides the same core operations. Filters and pagination can be combined.</p>
${code(`const keys = gzw.dataset("keys");
const keycards = await keys.filter(
  { type: "Keycard" },
  { page: 1, perPage: 25 },
);
const akWeapons = await gzw.dataset("weapons").search("AK", {
  page: 1,
  perPage: 10,
});
const weapon = await gzw.dataset("weapons").get("ak-12");
if (weapon) console.log(weapon.name);`)}
<p>A missing record from <code>get(id)</code> returns <code>undefined</code>. Other API errors throw <code>GzwApiError</code>.</p>
<h3>Cross-dataset search</h3>
${code(`const results = await gzw.search("AK-12", {
  datasets: ["weapons"],
  fields: ["name"],
  fuzzy: true,
  limit: 5,
});`)}
<h2>Iterate and batch-load</h2>
<p><code>iterate()</code> yields records page by page. <code>getMany()</code> loads known IDs with bounded concurrency. <code>dataset.export({ limit })</code> is still capped by the API's server-side maximum.</p>
${code(`for await (const weapon of gzw.dataset("weapons").iterate({ perPage: 50 })) {
  console.log(weapon.name);
}

const records = await gzw.dataset("weapons").getMany(
  ["ak-12", "ak-74"],
  { concurrency: 4 },
);`)}
<p>Helpers are also available for <code>stats()</code>, <code>health()</code>, <code>ready()</code>, <code>version()</code>, <code>metadata()</code>, <code>schema()</code>, <code>changes()</code>, <code>images()</code> and <code>spec()</code>.</p>
<h2 data-alias="types">Types and autocomplete</h2>
<p>The <code>KnownGzwDataset</code> union gives editor suggestions for names in the published SDK snapshot. Autocomplete is computed from local declarations, so it cannot query the API while you type. For a live picker inside your app, populate it from <code>gzw.metadata()</code>.</p>
<p><code>GzwDataset</code> also accepts arbitrary strings, so a name returned by the API works even if it is absent from the snapshot. Strongly typed models exist for selected stable datasets; unknown records use <code>GzwRecord</code>.</p>
${callout('tip', 'When does autocomplete change?', '<p>The SDK repository can refresh its generated names with <code>npm run generate-types</code>. Consumers receive new suggestions only when a later package version is published and installed. Routine dataset or count changes never trigger an npm release.</p>')}
<h2 data-alias="errors">Errors, retries and cancellation</h2>
<p>HTTP failures are exposed as <code>GzwApiError</code> with status, stable code, request URL and retry information. The client retries eligible rate-limit, server, transient network and invalid-response failures by default. It respects <code>Retry-After</code> and does not retry caller-aborted requests.</p>
${code(`import { GzwApiError } from "@zoniboy/gzw-data-client";

try {
  await gzw.dataset("weapons").list();
} catch (error) {
  if (error instanceof GzwApiError) {
    console.error(error.status, error.code, error.retryAfter);
  }
}`)}
<p>Pass an <code>AbortSignal</code> as the final method argument to cancel a request. A configured <code>timeoutMs</code> bounds each network attempt.</p>
<h2 data-alias="configuration">Configure retries, timeout and cache</h2>
<p>Defaults work for a small app. The response cache is off unless you configure a positive TTL, and it is in-memory per process, not persistent storage.</p>
${code(`const gzw = new GzwDataClient({
  retries: 2,
  timeoutMs: 15_000,
  cache: { ttlMs: 30_000, maxEntries: 100 },
});`)}
<p>Only successful GET responses are cached. Use <code>clearCache()</code> to clear all entries, or pass a path to invalidate one route's cached query variants.</p>
<h2 data-alias="runtime">Runtime, freshness and limits</h2>
<ul>
  <li>Release 0.9.0 targets Node.js 22+ and modern browsers with native <code>fetch</code>. Node.js 18 consumers can keep using 0.7.3. Browser projects should use a bundler such as Vite.</li>
  <li>The API is public, read-only and keyless, with a best-effort limit of 100 requests per minute per IP. See <a href="~/limits/">rate limits</a>.</li>
  <li>Data is refreshed by the scraper workflow and served through a CDN cache window, so new data may not appear immediately. Use <code>gzw.version()</code> or the response <code>dataVersion</code> to inspect the current snapshot. A data refresh is not an SDK release.</li>
</ul>
${callout('note', 'Where to report problems', `<p>SDK behaviour goes to the <a href="https://github.com/ZoniBoy00/gzw-data-client/issues" target="_blank" rel="noopener noreferrer">client repository</a>. Missing or wrong game data goes to the <a href="~/feedback/">feedback page</a>.</p>`)}
`,
  },
  {
    slug: 'python', icon: 'terminal', group: 'Clients', nav: 'Python', tab: 'Clients',
    title: 'Python client', desc: 'Install and use the official dependency-free Python client for the GZW Data API from PyPI.',
    body: `
<p class="lead">A small client for Python 3.9+ with no dependencies. It handles pagination, search, retries that honour <code>Retry-After</code>, and structured errors.</p>
<p><a href="https://pypi.org/project/gzw-data/" target="_blank" rel="noopener noreferrer">gzw-data on PyPI ↗</a>, latest release <code data-pkg-version="pypi">0.2.0</code>. Tested on Python 3.9, 3.11 and 3.13.</p>
${callout('note', 'Same data as every other client', '<p>Datasets are resolved from the live API. New datasets work immediately with <code>client.list("name")</code>, with nothing to update in the package.</p>')}
<h2 data-alias="quickstart">Install and make a request</h2>
${code(`pip install gzw-data`)}
${code(`from gzw_data import GzwDataClient

client = GzwDataClient()
weapon = client.get("weapons", "ak-12")
print(weapon["name"], weapon["caliber"])

page = client.list("weapons", per_page=5)
print(page["total"], [w["name"] for w in page["data"]])`)}
<p>Every method returns plain dictionaries and lists, exactly as the API sends them.</p>
<h2 data-alias="datasets">Datasets and records</h2>
<p><code>datasets()</code> maps every dataset name to its record count. <code>get()</code> returns one record, or <code>None</code> when the ID does not exist. <code>iterate()</code> walks every page for you.</p>
${code(`names = client.datasets()           # {'ammo': 79, 'weapons': 44, ...}
print(len(names), "datasets")

record = client.get("weapons", "does-not-exist")   # None

for ammo in client.iterate("ammo"):               # every record, page by page
    print(ammo["name"])`)}
<p><code>list()</code> returns one page with the full envelope: <code>data</code>, <code>page</code>, <code>perPage</code>, <code>total</code> and <code>totalPages</code>.</p>
<h2 data-alias="search">Search and filters</h2>
<p>Search inside one dataset with <code>search=</code>, or across all datasets with <code>search()</code>. Extra keyword arguments become query filters.</p>
${code(`# Inside one dataset
for gun in client.iterate("weapons", search="AK"):
    print(gun["name"])

# Across every dataset: {dataset name: [records]}
results = client.search("AK-12")
print(list(results))

# Filter by any string field
keycards = client.list("keys", type="Keycard", per_page=25)`)}
<h2 data-alias="errors">Errors and retries</h2>
<p>Failures raise <code>GzwApiError</code> with <code>status</code>, a stable <code>code</code>, the request <code>url</code> and, for rate limits, <code>retry_after</code> in seconds. Rate-limit (429) and server (5xx) responses are retried with backoff, and a <code>Retry-After</code> header is honoured up to <code>max_retry_wait</code>. Client errors such as 404 or 400 are not retried.</p>
${code(`from gzw_data import GzwApiError, GzwDataClient

client = GzwDataClient()
try:
    client.list("not_a_dataset")
except GzwApiError as error:
    print(error.status, error.code)   # 404 ENDPOINT_NOT_FOUND`)}
<h2>Configuration</h2>
<p>All options are keyword arguments of <code>GzwDataClient</code>.</p>
${code(`client = GzwDataClient(
    base_url="${BASE}",   # default
    timeout=10.0,                              # seconds per request
    retries=2,                                 # extra attempts after the first
    max_retry_wait=65.0,                       # longest Retry-After to wait for
    user_agent="my-bot/1.0",
)`)}
<p>For tests, pass <code>opener=</code> with a function that behaves like <code>urllib.request.urlopen</code>. The client's own test suite does this.</p>
<h2 data-alias="limits">Rate limit</h2>
<ul>
  <li>The API allows about 100 requests per minute per IP address, on a best-effort basis.</li>
  <li><code>iterate()</code> reads 100 records per request. Walking all datasets takes roughly one request per dataset, so cache results in a long-running bot instead of scanning on every command.</li>
  <li>The client waits and retries when the limit is hit, which can make a large scan pause for up to a minute.</li>
</ul>
${callout('note', 'Where to report problems', `<p>Client behaviour goes to the <a href="https://github.com/ZoniBoy00/gzw-data-py/issues" target="_blank" rel="noopener noreferrer">Python client repository</a>. Missing or wrong game data goes to the <a href="~/feedback/">feedback page</a>.</p>`)}
`,
  },
  {
    slug: 'playground', icon: 'flask-conical', group: 'Tools', nav: 'Playground', tab: 'Tools', scripts: ['playground.js'],
    title: 'Playground', desc: 'Build a request to the GZW Data API, run it live and copy it as cURL, JavaScript or Python.',
    body: `
<p class="lead">A small, read-only workbench for the public API. Pick an endpoint, adjust the inputs and inspect a real response. No API key needed.</p>
<div class="pg" data-playground>
  <form class="pg-form">
    <label for="pg-endpoint">Endpoint</label>
    <select id="pg-endpoint" name="endpoint"></select>
    <div class="pg-fields" data-pg-fields></div>
    <button class="btn primary" type="button" data-pg-run>Run request</button>
    <datalist id="pg-datasets"></datalist>
  </form>
  <div class="pg-out">
    <div class="pg-url"><span class="method">GET</span><code data-pg-url></code><button class="btn" type="button" data-pg-copy>Copy URL</button></div>
    <p class="pg-meta" role="status" data-pg-meta>Ready when you are. Choose an endpoint and run the request.</p>
    <pre tabindex="0" aria-label="Response" data-pg-body></pre>
  </div>
</div>
<h2>Turn it into code</h2>
<p>Every request is a plain GET. These snippets follow the request above.</p>
<div data-pg-snippets>${tabs([
  { name: 'cURL', code: 'curl "…"' },
  { name: 'JavaScript', code: 'const res = await fetch("…");' },
  { name: 'Python', code: 'import requests' },
])}</div>
<p>Read the <a href="~/querying/">query parameters</a>, or <a href="~/feedback/">report a problem</a> if a response looks wrong.</p>
`,
  },
  {
    slug: 'explorer', icon: 'compass', group: 'Tools', nav: 'Data explorer', tab: 'Tools', scripts: ['live.js'],
    title: 'Data explorer', desc: 'Pick a Gray Zone Warfare dataset, search it and inspect the same JSON your app will call.',
    body: `
<p class="lead">Pick a dataset, search it and open the same JSON endpoint your app will call.</p>
<noscript><p>The explorer needs JavaScript. The API itself works from any HTTP client, for example <code>${BASE}/stats</code>.</p></noscript>
<div class="ex" data-explorer>
  <div class="ex-controls">
    <div class="ex-field"><label for="ex-dataset">Dataset</label><input id="ex-dataset" name="dataset" list="ex-datasets" value="weapons" autocomplete="off" spellcheck="false"><datalist id="ex-datasets"></datalist></div>
    <div class="ex-field"><label for="ex-search">Search records</label><input id="ex-search" name="search" type="search" placeholder="Name, ID, caliber…" autocomplete="off"></div>
    <a class="btn" data-ex-json href="/api/v1/weapons" target="_blank" rel="noopener noreferrer">{{i:file-json}} Open JSON</a>
  </div>
  <p class="ex-summary" role="status" data-ex-summary>Loading live records…</p>
  <div class="ex-table-wrap"><table class="ex-table"><thead><tr><th scope="col">Name</th><th scope="col">Identifier</th><th scope="col">Preview</th></tr></thead><tbody data-ex-rows></tbody></table></div>
  <div class="ex-pager"><button class="btn" type="button" data-ex-prev>{{i:chevron-left}} Previous</button><span data-ex-page>Page 1</span><button class="btn" type="button" data-ex-next>Next {{i:chevron-right}}</button></div>
</div>
<p>Need other filters? See <a href="~/querying/">Filters, search &amp; pagination</a>, or build a request in the <a href="~/playground/">Playground</a>.</p>
`,
  },
  {
    slug: 'status', icon: 'activity', group: 'Tools', nav: 'Data status', tab: 'Tools', scripts: ['live.js'],
    title: 'Data status', desc: 'Live snapshot information for the GZW Data API: data version, last scrape, record counts and recent changes.',
    body: `
<p class="lead">Snapshot information straight from the live API, so you can tell whether the data you are reading is current.</p>
<div class="status-card" data-status-page>
  <p class="freshness" role="status" data-fresh>Checking the latest snapshot…</p>
  <dl class="kv">
    <div><dt>API version</dt><dd data-kv="api">…</dd></div>
    <div><dt>Data version</dt><dd data-kv="data">…</dd></div>
    <div><dt>Last full scrape</dt><dd data-kv="scrape">…</dd></div>
    <div><dt>Snapshot</dt><dd data-kv="snapshot">…</dd></div>
    <div><dt>Datasets in snapshot</dt><dd data-kv="datasets">…</dd></div>
    <div><dt>Records in snapshot</dt><dd data-kv="records">…</dd></div>
    <div><dt>Change history</dt><dd data-kv="history">…</dd></div>
  </dl>
  <p class="muted" data-kv="note"></p>
  <div class="ex-table-wrap" data-changes-wrap hidden><table class="ex-table"><caption class="sr-only">Datasets that changed since the previous snapshot</caption><thead><tr><th scope="col">Dataset</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead><tbody data-changes></tbody></table></div>
</div>
<h2>How updates work</h2>
<ul>
  <li>A scraper refreshes the data every week and opens a pull request, so every change is reviewed.</li>
  <li>A drop guard blocks accidental data loss, and a daily freshness check opens an issue if the data gets stale.</li>
  <li>Data routes use a 300 second CDN cache window, so new data can take a few minutes to appear.</li>
</ul>
<p>The same numbers are available as JSON from <a href="/api/v1/version">/api/v1/version</a> and <a href="/api/v1/changes">/api/v1/changes</a>.</p>
`,
  },
  {
    slug: 'data-sources', icon: 'scale', group: 'Project', nav: 'Data sources & licensing', tab: 'Docs',
    title: 'Data sources & licensing', desc: 'Where GZW Data comes from and how to credit it when you reuse it.',
    body: `
<p class="lead">Code is MIT. Game data is collected from the community wiki and may carry separate rights.</p>
<h2>Where the data comes from</h2>
<p>Datasets are scraped from the <a href="https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki">Gray Zone Warfare Wiki on Fandom</a>. Wiki text is generally offered under <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>, but individual records, images and assets can have separate rights. Images are linked from their source hosts, not copied.</p>
<h2>Crediting the data</h2>
<ul>
  <li>Credit the source wiki and link the license.</li>
  <li>Indicate that you modified the data if you did.</li>
  <li>Use dataset <code>source</code> and revision metadata as provenance hints.</li>
</ul>
${callout('warn', 'Not legal advice', `<p>Verify the license for the specific source page and asset you reuse. See the full <a href="${GH}/blob/main/DATA_LICENSE.md">DATA_LICENSE.md</a>.</p>`)}
<h2>Privacy and terms</h2>
<p>No accounts, no cookies, no analytics. Read the <a href="~/privacy/">Privacy Policy</a> and <a href="~/terms/">Terms of Service</a>.</p>
`,
  },
  {
    slug: 'feedback', icon: 'message-square', group: 'Project', nav: 'Feedback', tab: 'Docs',
    title: 'Feedback', desc: 'Choose the right way to report a GZW Data bug, missing data, feature request or API question.',
    body: `
<p class="lead">Found a bad record, a broken endpoint or an idea worth building? Pick the path that gives your report the right context from the start.</p>
${routes([
  { href: `${GH}/issues/new?template=data-quality.yml`, ext: true, icon: 'bug', title: 'Report missing or incorrect data', text: 'A missing item, weapon, task, image or value that needs checking.' },
  { href: 'mailto:support@gzw-data.dev?subject=GZW%20Data%20API%20question', icon: 'life-buoy', title: 'Ask an API question', text: 'Help with endpoints, datasets, pagination, responses or SDK usage.' },
  { href: `${GH}/issues/new?template=feature-request.yml`, ext: true, icon: 'lightbulb', title: 'Suggest a feature', text: 'An API improvement, documentation change or developer workflow.' },
  { href: 'mailto:security@gzw-data.dev?subject=GZW%20Data%20security%20report', icon: 'shield-alert', title: 'Report a vulnerability', text: 'Private channel. Do not open a public GitHub issue for security reports.' },
])}
<h2>Contact</h2>
<ul class="contact">
  <li>{{i:mail}}<div><a href="mailto:support@gzw-data.dev">support@gzw-data.dev</a><p>General API questions and support</p></div></li>
  <li>{{i:shield-alert}}<div><a href="mailto:security@gzw-data.dev">security@gzw-data.dev</a><p>Private vulnerability reports only</p></div></li>
</ul>
<h2>Make the report actionable</h2>
<p>Small details save a round of back-and-forth. Include:</p>
<ul>
  <li>The page or API endpoint</li>
  <li>The dataset and record ID</li>
  <li>What you expected and what you got</li>
  <li>A small request that reproduces it</li>
</ul>
${callout('warn', 'Keep secrets out', '<p>Never include passwords, API tokens, cookies or private personal data in a report.</p>')}
`,
  },
  { slug: 'privacy', icon: 'shield', group: 'Project', nav: 'Privacy Policy', tab: 'Docs', title: 'Privacy Policy', desc: 'How GZW Data handles request logs and feedback emails. No accounts, no tracking cookies.', body: () => legal('privacy-policy') },
  { slug: 'terms', icon: 'file-text', group: 'Project', nav: 'Terms of Service', tab: 'Docs', title: 'Terms of Service', desc: 'Terms of use for the free, community-run GZW Data API for Gray Zone Warfare.', body: () => legal('terms-of-service') },
];

const external = [
  { group: 'Clients', nav: 'npm package', url: 'https://www.npmjs.com/package/@zoniboy/gzw-data-client', icon: 'package' },
  { group: 'Clients', nav: 'PyPI package', url: 'https://pypi.org/project/gzw-data/', icon: 'package' },
  { group: 'Tools', nav: 'OpenAPI spec', url: '/api/v1/spec', icon: 'file-json' },
  { group: 'Project', nav: 'GZW Tools', url: 'https://gzw-tools.vercel.app/', icon: 'layers' },
  { group: 'Project', nav: 'Support the project', url: 'https://www.buymeacoffee.com/zoniboy00', icon: 'coffee' },
  { group: 'Project', nav: 'GitHub', url: GH, icon: 'book-marked' },
];

const notFound = {
  slug: '404', plain: true, tab: '', scripts: ['notfound.js'],
  title: 'Page not found', desc: 'The requested GZW Data page or API resource could not be found.',
  body: `
<section class="nf" aria-labelledby="error-title">
  <p class="nf-code" aria-hidden="true">404</p>
  <h1 id="error-title">This signal went dark.</h1>
  <p class="lead">There is no page at <code id="missing-path">this address</code>. It may have moved, or the link may have a typo.</p>
  <div id="suggestions" hidden><p class="nf-sub">Did you mean</p><ul id="suggestion-list"></ul></div>
  <div class="actions"><a class="btn primary" href="~/">{{i:house}} Back to the docs</a><a class="btn" href="~/quickstart/">{{i:rocket}} Quick start</a><a class="btn" href="/api/v1">{{i:file-json}} API root</a></div>
</section>
`,
};

module.exports = { pages, external, notFound };
