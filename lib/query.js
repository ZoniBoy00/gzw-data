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

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function matchesSearch(item, query, fields, fuzzy = false) {
  const values = fields.length > 0 ? fields.map(field => item[field]) : Object.values(item);
  const text = values.filter(value => typeof value === 'string').join(' ').toLowerCase();
  if (text.includes(query.toLowerCase())) return true;
  if (!fuzzy) return false;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  return values.some(value => {
    const candidate = normalizeSearchText(value);
    if (!candidate) return false;
    return candidate.includes(normalizedQuery) || levenshtein(candidate, normalizedQuery) <= Math.max(1, Math.floor(normalizedQuery.length / 4));
  });
}

module.exports = { paginate, applyFilters, parsePagination, matchesSearch };
