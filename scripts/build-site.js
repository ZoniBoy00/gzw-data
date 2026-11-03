#!/usr/bin/env node
// Builds the whole public site (home, docs, tools, legal pages, 404) from site-src/pages.js into web/ as static
// HTML that works under the production CSP (no inline scripts or styles). Run `npm run build:site`; `--check`
// fails when the generated files are stale. Internal links in page content are written as "~/slug/" and resolved
// through ROUTES. Icons are Lucide (ISC, see site-src/icons/LICENSE-lucide.txt). Pages write {{i:name}}; each page
// embeds an SVG sprite containing only the icons it uses.
const fs = require('node:fs');
const path = require('node:path');
const { pages, external, notFound } = require('../site-src/pages.js');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const ICON_DIR = path.join(__dirname, '..', 'site-src', 'icons');
const ORIGIN = 'https://gzw-data.dev';
// Public URL of every page. Existing URLs (/docs/sdk/, /playground/, /privacy-policy/ ...) are kept so links and
// search rankings survive the redesign.
const ROUTES = {
  '': '/', quickstart: '/docs/', datasets: '/datasets/', querying: '/querying/', records: '/records/',
  responses: '/responses/', limits: '/limits/', examples: '/docs/examples/', clients: '/clients/',
  sdk: '/docs/sdk/', python: '/docs/python/', playground: '/playground/', explorer: '/explorer/',
  status: '/status/', 'data-sources': '/data-sources/', feedback: '/feedback/',
  privacy: '/privacy-policy/', terms: '/terms-of-service/',
};
const GROUP_ORDER = ['Getting started', 'API reference', 'Guides', 'Clients', 'Tools', 'Project'];
const TABS = [
  { name: 'Docs', url: '~/' },
  { name: 'API reference', url: '~/datasets/' },
  { name: 'Clients', url: '~/clients/' },
  { name: 'Tools', url: '~/playground/' },
];
// Icons that scripts reference at runtime (copy button, search palette, notices).
const RUNTIME_ICONS = ['copy', 'check', 'circle-alert', 'circle-check', 'search', 'x'];

const route = slug => {
  if (!(slug in ROUTES)) throw new Error(`Unknown page link: ~/${slug}/`);
  return ROUTES[slug];
};
const link = s => s.replace(/~\/([a-z0-9-]*)\/?/g, (_m, slug) => route(slug));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const urlOf = p => route(p.slug);
const bodyOf = p => link(typeof p.body === 'function' ? p.body() : p.body);

const iconInner = name => {
  const file = path.join(ICON_DIR, `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`Missing icon: ${name} (copy it from lucide-static into site-src/icons)`);
  return fs.readFileSync(file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
};
const ic = (name, cls = '') => `<svg class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
const withIcons = html => html.replace(/\{\{i:([a-z0-9-]+)\}\}/g, (_m, name) => ic(name));
const sprite = html => {
  const names = new Set([...RUNTIME_ICONS, ...[...html.matchAll(/href="#i-([a-z0-9-]+)"/g)].map(m => m[1])]);
  return `<svg class="sprite" aria-hidden="true" focusable="false">${[...names].sort().map(n => `<symbol id="i-${n}" viewBox="0 0 24 24">${iconInner(n)}</symbol>`).join('')}</svg>`;
};

// Add ids and hover anchors to headings; collect them for the right-hand TOC and search index.
function processHeadings(html) {
  const headings = [];
  // <h2 data-id="sdk"> pins an anchor that older external links already use.
  const body = html.replace(/<h([23])(?: data-id="([a-z0-9-]+)")?>(.*?)<\/h\1>/g, (_m, level, pinned, inner) => {
    const id = pinned || slugify(inner);
    headings.push({ level: Number(level), id, text: inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') });
    return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`;
  });
  return { body, headings };
}

function sidebar(current) {
  return GROUP_ORDER.map(group => {
    const links = [
      ...pages.filter(p => p.group === group).map(p =>
        `<a href="${urlOf(p)}"${p === current ? ' class="active" aria-current="page"' : ''}>${ic(p.icon || 'file-text')}<span>${esc(p.nav)}</span></a>`),
      ...external.filter(e => e.group === group).map(e =>
        `<a href="${link(e.url)}"${e.url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${ic(e.icon || 'external-link')}<span>${esc(e.nav)}</span>${ic('external-link', 'ext')}</a>`),
    ];
    return links.length ? `<div class="nav-group"><p class="nav-title">${group}</p><ul>${links.map(l => `<li>${l}</li>`).join('')}</ul></div>` : '';
  }).join('');
}

function jsonLd(page) {
  const url = `${ORIGIN}${urlOf(page)}`;
  const person = { '@type': 'Person', name: 'ZoniBoy00', url: 'https://github.com/ZoniBoy00' };
  const graph = page.slug === ''
    ? [
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: 'GZW Data', description: 'Free Gray Zone Warfare game data API', inLanguage: 'en' },
      { '@type': 'WebAPI', name: 'GZW Data API', url: `${ORIGIN}/api/v1`, documentation: `${ORIGIN}/docs/`, description: 'Free, read-only JSON API for Gray Zone Warfare weapons, ammo, armor, tasks and loot. No API key required.', isAccessibleForFree: true, provider: person },
    ]
    : [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'GZW Data', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: page.group, item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 3, name: page.nav, item: url },
      ] },
      { '@type': 'TechArticle', headline: page.title, description: page.desc, url, inLanguage: 'en', isPartOf: { '@id': `${ORIGIN}/#website` }, author: person },
    ];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

function head(page, title, canonical) {
  const d = esc(page.desc);
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  ${page.plain ? '<meta name="robots" content="noindex">' : ''}
  <title>${esc(title)}</title>
  <meta name="description" content="${d}">
  ${page.keywords ? `<meta name="keywords" content="${esc(page.keywords)}">` : ''}
  ${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
  <meta name="theme-color" content="#0a0c0e">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${d}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="GZW Data">
  ${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
  <meta property="og:image" content="${ORIGIN}/assets/og-image.png">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:image" content="${ORIGIN}/assets/og-image.png">
  ${page.slug === '' ? '<meta name="google-site-verification" content="I98JTMaW-7m72H-sywjmHhXfghcaM_B7Y_EPhbirnAE">' : ''}
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/gzw-data-favicon-48.png">
  <link rel="apple-touch-icon" href="/assets/gzw-data-apple-touch.png">
  <script src="/assets/theme.js"></script>
  <link rel="preload" href="/assets/fonts/barlow-semi-condensed-700.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/site.css">
  ${canonical && !page.plain ? jsonLd(page) : ''}
</head>`;
}

function topbar(page) {
  const tabs = TABS.map(t => `<a href="${link(t.url)}"${t.name === page.tab ? ' class="active" aria-current="true"' : ''}>${t.name}</a>`).join('');
  return `<header class="topbar">
    ${page.plain ? '' : `<button class="menu-btn" type="button" aria-label="Toggle navigation" aria-controls="docs-nav" aria-expanded="false">{{i:menu}}</button>`}
    <a class="brand" href="/"><picture><source srcset="/assets/gzw-data-logo.webp" type="image/webp"><img src="/assets/gzw-data-logo.png" alt="" width="30" height="28"></picture>GZW Data <small>docs</small></a>
    <nav class="tabs" aria-label="Site sections">${tabs}</nav>
    <div class="top-right">
      <span class="status" role="status">{{i:activity}}<span data-status>API</span></span>
      <button class="search-btn" type="button">{{i:search}}<span class="stext">Search docs…</span><kbd>Ctrl K</kbd></button>
      <button class="theme-btn" type="button" aria-label="Switch to light theme">{{i:sun-moon}}</button>
      <a class="icon-link" href="https://github.com/ZoniBoy00/gzw-data" target="_blank" rel="noopener noreferrer">GitHub {{i:external-link}}</a>
    </div>
  </header>`;
}

const footer = link(`<footer class="footer">
        <p class="footer-note">© <span data-year>2026</span> GZW Data. Code under MIT, data from the community wiki (CC BY-SA). Not affiliated with MADFINGER Games.</p>
        <nav class="footer-links" aria-label="Footer">
          <a href="~/data-sources/">Data sources</a><a href="~/privacy/">Privacy</a><a href="~/terms/">Terms</a><a href="~/feedback/">Feedback</a><a href="/.well-known/security.txt">Security</a>
          <a href="https://gzw-tools.vercel.app/" target="_blank" rel="noopener noreferrer">GZW Tools {{i:external-link}}</a>
          <a href="https://www.buymeacoffee.com/zoniboy00" target="_blank" rel="noopener noreferrer">{{i:coffee}} Support the project</a>
        </nav>
        <a class="saas-badge" href="https://saasbrowser.com/en/saas/1693997/gzw-data" target="_blank" rel="noopener noreferrer"><img src="/assets/saas-browser-badge-12.svg" alt="GZW Data on SaaS Browser" width="140" height="49" loading="lazy"></a>
      </footer>`);

const palette = `<div class="palette" role="dialog" aria-modal="true" aria-label="Search documentation"><div class="palette-box"><input type="text" name="q" role="combobox" aria-expanded="false" aria-controls="palette-list" aria-autocomplete="list" placeholder="Search pages and sections…" autocomplete="off" aria-label="Search documentation"><div class="palette-list" id="palette-list" role="listbox" aria-label="Results"></div></div></div>`;

function scriptsFor(page) {
  const deferred = [`/assets/versions.js`, '/assets/site.js', ...(page.scripts || []).map(f => `/assets/${f}`)]
    .map(src => `<script src="${src}" defer></script>`).join('\n  ');
  return `<script src="/assets/nav.js"></script>\n  ${deferred}`;
}

function render(page, idx) {
  const processed = processHeadings(bodyOf(page));
  const { headings } = processed;
  // Wide tables scroll inside their own region instead of stretching the page on phones.
  const body = processed.body.replace(/<table(?![^>]*ex-table)[\s\S]*?<\/table>/g, m => `<div class="table-wrap" role="region" aria-label="Scrollable table" tabindex="0">${m}</div>`);
  const prev = pages[idx - 1], next = pages[idx + 1];
  const toc = headings.length
    ? `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><div class="toc-links"><span class="toc-marker" aria-hidden="true"></span>${headings.map(h => `<a href="#${h.id}"${h.level === 3 ? ' class="sub"' : ''}>${esc(h.text)}</a>`).join('')}</div></nav>`
    : '<div class="toc"></div>';
  const crumbs = page.slug
    ? `<a href="/">{{i:house}} Docs</a><span aria-hidden="true">/</span><span>${esc(page.group)}</span><span aria-hidden="true">/</span><span>${esc(page.nav)}</span>`
    : '<span>{{i:house}} Docs</span>';
  const title = page.seoTitle || `${page.title} · GZW Data`;
  const html = `${head(page, title, `${ORIGIN}${urlOf(page)}`)}
<body>
  <a class="skip" href="#content">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
  ${topbar(page)}
  <div class="scrim"></div>
  <div class="shell">
    <nav class="sidebar" id="docs-nav" aria-label="Documentation">${sidebar(page)}</nav>
    <main class="main" id="content" tabindex="-1">
      <div class="crumbs">${crumbs}</div>
      <article class="doc">
        ${page.hero ? '' : `<h1>${esc(page.title)}</h1>`}
        ${body}
      </article>
      <div class="pager">
        ${prev ? `<a class="prev" href="${urlOf(prev)}">{{i:chevron-left}}<span><small>Previous</small><strong>${esc(prev.nav)}</strong></span></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${urlOf(next)}"><span><small>Next</small><strong>${esc(next.nav)}</strong></span>{{i:chevron-right}}</a>` : ''}
      </div>
      <p class="edit"><a href="https://github.com/ZoniBoy00/gzw-data/issues/new" target="_blank" rel="noopener noreferrer">Report a docs issue {{i:external-link}}</a></p>
      ${footer}
    </main>
    ${toc}
  </div>
  ${palette}
  ${scriptsFor(page)}
</body>
</html>
`;
  return withIcons(html).replace('<body>', `<body>\n  ${sprite(withIcons(html))}`);
}

function renderPlain(page) {
  const { body } = processHeadings(bodyOf(page));
  const html = `${head(page, `${page.title} · GZW Data`, '')}
<body class="plain">
  <a class="skip" href="#content">Skip to content</a>
  ${topbar(page)}
  <main class="plain-main" id="content" tabindex="-1">
    ${body}
    ${footer}
  </main>
  ${palette}
  ${scriptsFor(page)}
</body>
</html>
`;
  return withIcons(html).replace('<body class="plain">', `<body class="plain">\n  ${sprite(withIcons(html))}`);
}

// Everything the build writes goes through here so --check can compare without touching disk.
const outputs = new Map();
const emit = (file, content) => outputs.set(path.join(ROOT, file), content.replace(/[ \t]+$/gm, ''));
const htmlPath = url => path.join('web', url, 'index.html');

const searchIndex = [];
pages.forEach((page, idx) => {
  emit(htmlPath(urlOf(page)), render(page, idx));
  searchIndex.push({ title: page.nav, section: page.group, url: urlOf(page) });
  for (const h of processHeadings(bodyOf(page)).headings) {
    searchIndex.push({ title: h.text, section: page.nav, url: `${urlOf(page)}#${h.id}` });
  }
});
for (const e of external) searchIndex.push({ title: e.nav, section: `${e.group} ↗`, url: link(e.url) });
emit('404.html', renderPlain(notFound));
emit('web/assets/search-index.json', JSON.stringify(searchIndex));

if (process.argv.includes('--check')) {
  // Asset stamps (?v=hash) are added by stamp-assets.js after the build, so ignore them when comparing.
  const unstamped = text => text.replace(/\?v=[0-9a-f]{8}/g, '');
  const stale = [...outputs].filter(([file, content]) => !fs.existsSync(file) || unstamped(fs.readFileSync(file, 'utf8')) !== unstamped(content));
  if (stale.length) {
    console.error(`Generated site files are stale: ${stale.map(([f]) => path.relative(ROOT, f)).join(', ')}. Run "npm run build:site".`);
    process.exit(1);
  }
  console.log('Generated site files are current.');
} else {
  for (const [file, content] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  console.log(`Built ${pages.length} pages and the 404 page.`);
}
