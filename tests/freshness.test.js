const test = require('node:test');
const assert = require('node:assert/strict');
const { assessDataFreshness } = require('../scripts/check-data-freshness');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T12:00:00.000Z');

test('freshness probe accepts a scrape within the configured window', () => {
  const result = assessDataFreshness(
    { lastFullScrapeAt: new Date(NOW.getTime() - 9 * DAY_MS).toISOString() },
    NOW,
    10,
  );

  assert.equal(result.stale, false);
  assert.equal(result.reason, 'fresh');
  assert.equal(result.ageDays, 9);
});

test('freshness probe reads the API response data envelope', () => {
  const result = assessDataFreshness(
    { data: { lastFullScrapeAt: new Date(NOW.getTime() - 2 * DAY_MS).toISOString() } },
    NOW,
    10,
  );

  assert.equal(result.stale, false);
  assert.equal(result.ageDays, 2);
});

test('freshness probe flags a scrape older than the configured threshold', () => {
  const result = assessDataFreshness(
    { lastFullScrapeAt: new Date(NOW.getTime() - 11 * DAY_MS).toISOString() },
    NOW,
    10,
  );

  assert.equal(result.stale, true);
  assert.equal(result.reason, 'scrape_age_exceeds_threshold');
  assert.equal(result.ageDays, 11);
});

test('freshness probe flags missing, invalid, and future timestamps', () => {
  assert.equal(assessDataFreshness({}, NOW).reason, 'missing_last_full_scrape_at');
  assert.equal(assessDataFreshness({ lastFullScrapeAt: 'not-a-date' }, NOW).reason, 'invalid_last_full_scrape_at');
  assert.equal(
    assessDataFreshness({ lastFullScrapeAt: new Date(NOW.getTime() + DAY_MS).toISOString() }, NOW).reason,
    'future_last_full_scrape_at',
  );
});
