const { DEFAULT_PER_PAGE, MAX_PER_PAGE } = require('./config');

function paginate(items, page, perPage) {
  const total = items.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  return { items: items.slice(start, start + perPage), page, perPage, total, totalPages };
}

function applyFilters(items, params) {
  let filtered = [...items];
  for (const [key, value] of params.entries()) {
    if (!value) continue;
    const query = value.toLowerCase();

    if (key === 'search') {
      filtered = filtered.filter(item =>
        JSON.stringify(Object.values(item)).toLowerCase().includes(query) ||
        (item.name && item.name.toLowerCase().includes(query))
      );
    } else if (key === 'sort') {
      const [field, direction] = value.split(':');
      filtered.sort((left, right) => direction === 'desc'
        ? String(right[field] || '').localeCompare(String(left[field] || ''))
        : String(left[field] || '').localeCompare(String(right[field] || ''))
      );
    } else if (key === 'limit') {
      const limit = Math.min(parseInt(value) || DEFAULT_PER_PAGE, MAX_PER_PAGE);
      filtered = filtered.slice(0, limit);
    } else {
      filtered = filtered.filter(item => item[key] && String(item[key]).toLowerCase() === query);
    }
  }
  return filtered;
}

function parsePagination(params) {
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(params.get('per_page')) || DEFAULT_PER_PAGE));
  return { page, perPage };
}

module.exports = { paginate, applyFilters, parsePagination };
