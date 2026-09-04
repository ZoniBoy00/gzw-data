const { applyFilters } = require('./query');

const MAX_EXPORT_RECORDS = 500;

function buildExport(items, params) {
  const exportParams = new URLSearchParams(params);
  exportParams.delete('page');
  exportParams.delete('per_page');
  exportParams.delete('all');

  const filtered = applyFilters(items, exportParams);
  if (filtered.length > MAX_EXPORT_RECORDS) {
    return {
      error: 'EXPORT_TOO_LARGE',
      maxRecords: MAX_EXPORT_RECORDS,
      matchingRecords: filtered.length,
    };
  }

  return {
    records: filtered,
    count: filtered.length,
    maxRecords: MAX_EXPORT_RECORDS,
  };
}

module.exports = { MAX_EXPORT_RECORDS, buildExport };
