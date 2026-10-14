function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveIdAlias(registry, datasetName, requestedId) {
  const datasetAliases = isRecord(registry) && isRecord(registry.datasets)
    && Object.hasOwn(registry.datasets, datasetName)
    ? registry.datasets[datasetName]
    : null;
  if (!isRecord(datasetAliases) || !Object.hasOwn(datasetAliases, requestedId)) return requestedId;
  const canonicalId = datasetAliases[requestedId];
  return typeof canonicalId === 'string' && canonicalId.trim() ? canonicalId : null;
}

function validateIdAliases(registry, datasetRecords) {
  const errors = [];
  if (!isRecord(registry)) return ['_id_aliases.json must be an object'];
  if (registry.schemaVersion !== 1) errors.push('_id_aliases.json schemaVersion must be 1');
  if (!isRecord(registry.datasets)) {
    errors.push('_id_aliases.json datasets must be an object');
    return errors;
  }

  for (const [datasetName, aliases] of Object.entries(registry.datasets)) {
    if (!Object.hasOwn(datasetRecords, datasetName)) {
      errors.push(`${datasetName}: alias registry references an unknown dataset`);
      continue;
    }
    if (!isRecord(aliases)) {
      errors.push(`${datasetName}: aliases must be an object mapping old IDs to current IDs`);
      continue;
    }

    const records = Array.isArray(datasetRecords[datasetName])
      ? datasetRecords[datasetName]
      : [];
    const canonicalIds = new Set(records
      .filter(record => isRecord(record) && typeof record.id === 'string')
      .map(record => record.id));

    for (const [aliasId, canonicalId] of Object.entries(aliases)) {
      if (!aliasId.trim() || typeof canonicalId !== 'string' || !canonicalId.trim()) {
        errors.push(`${datasetName}: alias IDs and canonical IDs must be non-empty strings`);
        continue;
      }
      if (aliasId === canonicalId) errors.push(`${datasetName}.${aliasId}: self-alias is not allowed`);
      if (canonicalIds.has(aliasId)) errors.push(`${datasetName}.${aliasId}: alias collides with a current record ID`);
      if (!canonicalIds.has(canonicalId)) errors.push(`${datasetName}.${aliasId}: canonical record '${canonicalId}' does not exist`);
      if (Object.hasOwn(aliases, canonicalId)) errors.push(`${datasetName}.${aliasId}: alias chains are not allowed`);
    }
  }
  return errors;
}

module.exports = { resolveIdAlias, validateIdAliases };
