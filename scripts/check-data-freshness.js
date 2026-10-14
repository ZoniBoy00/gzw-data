const DEFAULT_MAX_AGE_DAYS = 10;
const DEFAULT_VERSION_URL = "https://gzw-data.dev/api/v1/version";
const DAY_MS = 24 * 60 * 60 * 1000;

function assessDataFreshness(payload, now = new Date(), maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const version = payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
  const rawTimestamp = version && version.lastFullScrapeAt;
  if (typeof rawTimestamp !== "string" || !rawTimestamp.trim()) {
    return { stale: true, reason: "missing_last_full_scrape_at", lastFullScrapeAt: null, ageDays: null };
  }

  const scrapedAt = Date.parse(rawTimestamp);
  if (!Number.isFinite(scrapedAt)) {
    return { stale: true, reason: "invalid_last_full_scrape_at", lastFullScrapeAt: rawTimestamp, ageDays: null };
  }

  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const ageMs = nowMs - scrapedAt;
  if (!Number.isFinite(nowMs) || ageMs < 0) {
    return { stale: true, reason: "future_last_full_scrape_at", lastFullScrapeAt: rawTimestamp, ageDays: null };
  }

  const ageDays = ageMs / DAY_MS;
  return {
    stale: ageDays > maxAgeDays,
    reason: ageDays > maxAgeDays ? "scrape_age_exceeds_threshold" : "fresh",
    lastFullScrapeAt: new Date(scrapedAt).toISOString(),
    ageDays: Number(ageDays.toFixed(2)),
  };
}

function writeGitHubOutputs(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const fs = require("node:fs");
  const safeTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result.lastFullScrapeAt || "")
    ? result.lastFullScrapeAt
    : "";
  fs.appendFileSync(outputPath, [
    `stale=${String(result.stale)}`,
    `reason=${result.reason}`,
    `last_full_scrape_at=${safeTimestamp}`,
    `age_days=${result.ageDays ?? "unknown"}`,
    "",
  ].join("\n"));
}

async function main() {
  const url = process.env.GZW_VERSION_URL || DEFAULT_VERSION_URL;
  const maxAgeDays = Number(process.env.MAX_DATA_AGE_DAYS || DEFAULT_MAX_AGE_DAYS);
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error("MAX_DATA_AGE_DAYS must be a positive number");
  }

  try {
    const response = await globalThis.fetch(url, {
      headers: { "cache-control": "no-cache" },
      signal: globalThis.AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Version endpoint returned HTTP ${response.status}`);
    const result = assessDataFreshness(await response.json(), new Date(), maxAgeDays);
    writeGitHubOutputs(result);
    console.log(JSON.stringify(result));
    if (result.stale) process.exitCode = 1;
  } catch (error) {
    const result = { stale: true, reason: "probe_failed", lastFullScrapeAt: null, ageDays: null };
    writeGitHubOutputs(result);
    console.error(JSON.stringify({ ...result, message: error instanceof Error ? error.message : "Unknown probe error" }));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { assessDataFreshness, DEFAULT_MAX_AGE_DAYS };
