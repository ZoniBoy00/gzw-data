const fs = require('node:fs');
const { validateTarget } = require('../tests/security/target');

function previewTarget(event, requested) {
  const candidate = requested || event.deployment_status?.environment_url;
  if (!candidate) throw new Error('No preview environment URL supplied');
  const target = validateTarget(candidate);
  if (target.local) throw new Error('Hosted preview workflow does not accept loopback targets');
  return target.baseURL;
}

async function verifyDeployment(deployment, { repository, token, fetchImpl = fetch }) {
  const sha = deployment.sha;
  if (!/^[a-f0-9]{40}$/.test(sha || '') || repository !== 'ZoniBoy00/gzw-data' || !token) {
    throw new Error('Unexpected preview deployment repository/commit or missing read token');
  }
  // Only repository branch heads are trusted; fork previews must never receive the bypass secret.
  const response = await fetchImpl(`https://api.github.com/repos/ZoniBoy00/gzw-data/commits/${sha}/branches-where-head`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  const branches = response.ok ? await response.json() : null;
  if (!Array.isArray(branches) || !branches.length) {
    throw new Error('Preview is not a current branch head in this repository; fork/superseded previews are not trusted');
  }
}

async function main() {
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const baseURL = previewTarget(event, process.env.REQUESTED_PREVIEW_URL);
  if (event.deployment) await verifyDeployment(event.deployment, { repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `base_url=${baseURL}\n`);
  console.log(`Validated gzw-data preview: ${baseURL}`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { previewTarget, verifyDeployment };
