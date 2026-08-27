# Contributing to GZW Data

Thanks for helping improve the Gray Zone Warfare data API.

## Repository scope

`gzw-data` is the API and data-serving repository. It contains:

- The Vercel API handler in `api/`
- Reusable API modules in `lib/`
- Published JSON datasets in `data/`
- API integration tests in `tests/`
- Documentation and web console assets

Scraper/parser changes belong in the [`gzw-scraper`](https://github.com/ZoniBoy00/gzw-scraper) repository. SDK changes belong in [`gzw-data-js`](https://github.com/ZoniBoy00/gzw-data-js).

## Before opening an issue or pull request

- Search existing issues and pull requests.
- Use the structured GitHub Issue Forms when applicable.
- Do not include API keys, tokens, cookies, private URLs, or other secrets.
- Do not report unverified gameplay relationships as confirmed data.
- Use `/api/v1` in new examples and integrations. The legacy `/api` prefix exists for compatibility only.

## Local setup

Requirements:

- Node.js 18 or newer
- npm

Install dependencies if the repository has them available locally:

```bash
npm install
```

The API is deployed through Vercel. The `npm start` and `npm run dev` scripts execute the handler directly; use the Vercel CLI or the hosted API when you need a full HTTP server locally.

## Developing the API

Keep `api/index.js` focused on request routing. Put reusable behavior in the smallest appropriate module under `lib/`.

Current module areas include:

- `lib/datasets.js` — dataset loading and registry information
- `lib/query.js` — filtering, pagination, and search
- `lib/metadata.js` — dataset metadata and schema generation
- `lib/snapshots.js` — snapshot history and change reports
- `lib/smart-routes.js` — explicitly defined combined routes
- `lib/response.js` — response envelopes and headers
- `lib/rate-limit.js` — best-effort rate limiting

When changing an endpoint:

1. Preserve the `/api/v1` contract.
2. Keep legacy `/api` compatibility unless the change explicitly targets a breaking release.
3. Use stable error codes for client-visible errors.
4. Update OpenAPI output when the route or response changes.
5. Update README or docs examples when public behavior changes.
6. Add a regression test for the changed behavior.
7. Do not add inferred relationships unless the source data is verified.

## Working with data

Do not manually edit generated dataset JSON unless the change is an intentional fixture or emergency correction with a verifiable source.

The normal data flow is:

```text
GZW wiki
  -> gzw-scraper
  -> generated JSON
  -> gzw-data/data
  -> API deployment
```

After a verified data update, record the snapshot with:

```bash
npm run snapshot:record
```

Do not treat `_metadata.json` or `_history.json` as normal game datasets.

## Tests and checks

Run the complete local check before opening a pull request:

```bash
node --check api/index.js
npm test
git diff --check
```

If lint dependencies are installed, also run:

```bash
npm run lint
```

For API contract changes, test both the local handler and the deployed `/api/v1` endpoint when appropriate. Live checks must be read-only and must not use secrets in command output.

## Pull requests

A pull request should include:

- A focused title and description
- The reason for the change
- The affected endpoint, dataset, or module
- Tests that were run and their real results
- Documentation updates for public API changes
- Any compatibility or migration notes

Keep unrelated formatting and refactors out of the pull request.

## Commits

Use a concise conventional-style subject, for example:

```text
feat: add dataset schema endpoint
fix: preserve API error codes
chore: update generated metadata
```

Use real line breaks in commit bodies. Do not put literal `\\n` escape sequences in commit messages or documentation examples.

## Data quality standard

Every proposed data correction should include a verifiable source when possible:

- Official patch notes
- A directly inspectable wiki source
- A reproducible API response
- A screenshot with enough context

Do not publish weapon compatibility or task requirement relationships based only on matching names or descriptions.
