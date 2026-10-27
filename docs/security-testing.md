# Browser, API and CDN regression tests

This suite supplements `npm test`; it does not prove absence of all vulnerabilities.
It runs against a dedicated local server or an allowlisted gzw-data Vercel preview.
Production/custom hosts are rejected by default, including `gzw-data.dev`.

## Local run

Node.js 22+ is required. From the repository root:

```sh
npm ci --ignore-scripts
npx playwright install chromium firefox
npm run test:security
```

Playwright starts/stops the loopback server automatically. It refuses to reuse an
already-running server, so tests cannot silently run against a different checkout.
Linux/CI machines may need `npx playwright install --with-deps chromium firefox`.

Subsets and reports:

```sh
npm run test:security:api
npm run test:security:browser
npm run test:security:report
```

Reports are written to `playwright-report/` (HTML) and `test-results/security.json`.
Screenshots and local traces are retained for failures. These folders and `.tmp/`
are ignored by Git and excluded from the Vercel upload.

## Preview run

Set `SECURITY_BASE_URL` to an origin such as
`https://gzw-data-<deployment>-zoniboy00s-projects.vercel.app`, then run
`npm run test:security`. In PowerShell:

```powershell
$env:SECURITY_BASE_URL = 'https://gzw-data-<deployment>-zoniboy00s-projects.vercel.app'
npm run test:security
```

The hostname must belong to this project's preview namespace. Credentials,
custom ports, paths, query strings and fragments in the base URL are rejected.
Update `tests/security/target.js` and its unit tests if the Vercel team/project
namespace changes. Do not broaden it to arbitrary `*.vercel.app` hosts.

For a protected preview, optionally set `VERCEL_AUTOMATION_BYPASS_SECRET` locally
or add a GitHub Actions secret with that name using the project's Vercel
Protection Bypass for Automation setting. Do not paste the secret into an issue,
a command argument or a URL. The setup sends it once to the validated preview
without following redirects and stores the resulting scoped cookie under
`.tmp/security-auth.json`. It never applies bypass headers to registry requests.
Remote traces are disabled, and authentication state is not uploaded as an artifact.
Browser navigations to the target send Vercel's supported `x-vercel-skip-toolbar: 1`
automation header, so the preview toolbar does not inject an external script.
The application's CSP remains strict and CSP violations still fail tests.
Missing/invalid preview access fails the run rather than silently skipping tests.

## GitHub Actions

`Security regressions` runs locally for pushes to main and pull requests.
It also runs against successful non-production `Preview` deployment-status events.
The preview job checks out the reviewed harness from main, not code from an
untrusted preview commit. Deployment events must also point to a current branch
head in this repository; fork and superseded previews fail validation before
any bypass secret is used. Manual preview URLs should identify trusted deployments.
It uses a read-only token and does not post comments.

For providers that do not emit GitHub `deployment_status` events, use the workflow's
manual `preview_url` input after the preview is ready. An empty input runs locally.
Each job uploads its HTML/JSON reports for seven days, even when tests fail.
CI is useful only when the job actually runs: check the run result and artifacts.
A protected preview requires the optional secret before remote checks can pass.

## Coverage and limits

| Area | What is exercised |
| --- | --- |
| OpenAPI contracts | Real health, list, record, search, export and metadata responses validated against the deployed spec using AJV |
| Invalid inputs | Bounded long/missing queries, prototype-like names, record IDs and pagination/query-order combinations; null-byte paths may be rejected by the Vercel edge (400) before the application (404) |
| Read-only behavior | POST/PUT/DELETE denial and non-credentialed public CORS |
| Headers | CSP/nosniff/frame denial on regular, prefetch-shaped and 404 HTML |
| CDN regression | Forwarding-header isolation on unique health and dataset query URLs, followed by an ordinary request |
| Browser behavior | Chromium and Firefox: live explorer, search, error/recovery, Playground, 404 navigation and mobile viewport |
| Rendering | Synthetic HTML-like scraped values remain text, no injected image nodes or script effects |
| Runtime | Uncaught page exceptions, API 429 responses and CSP violations fail the run |
| Development server | Malformed URL returns 400, next request succeeds; local CSP/redirects match deployment configuration |

There is one worker, no automatic retries and a short delay between HTTP probes.
The suite stops after its first failure, including rate limiting; do not bypass the
quota with changing identities. Browser failure/rendering scenarios use in-browser
fixtures so they do not require altering published datasets or stressing the API.
Real smoke and API/CDN tests still hit the selected target. No destructive writes,
password guessing, high-load tests or external-host scanning are included.

A local run tests the handler and production-like headers, not Vercel's CDN.
A preview run checks cache isolation but does not require a cache HIT: a correct
uncached response must pass too. It does not prove every edge region or cache state.
This package is not a full DAST, supply-chain audit, penetration test or accessibility
certification. Continue manual review and turn each confirmed new defect into a
regression with a concrete before/after assertion.
