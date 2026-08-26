function buildSnapshot(datasets, asArray, capturedAt) {
  const counts = {};
  for (const key of Object.keys(datasets)) {
    if (key.startsWith('_')) continue;
    const items = asArray(key);
    if (items.length > 0) counts[key] = items.length;
  }
  return {
    version: capturedAt || null,
    capturedAt: capturedAt || null,
    datasets: counts,
  };
}

function getSnapshotHistory(datasets, asArray, currentVersion) {
  const stored = Array.isArray(datasets._history) ? datasets._history : [];
  const history = stored
    .filter(snapshot => snapshot && typeof snapshot === 'object' && typeof snapshot.version === 'string')
    .map(snapshot => ({
      version: snapshot.version,
      capturedAt: snapshot.capturedAt || snapshot.version,
      datasets: snapshot.datasets && typeof snapshot.datasets === 'object' ? snapshot.datasets : {},
    }));

  if (history.length === 0 && currentVersion) {
    history.push(buildSnapshot(datasets, asArray, currentVersion));
  }
  return history;
}

function buildChanges(datasets, asArray, currentVersion) {
  const history = getSnapshotHistory(datasets, asArray, currentVersion);
  const current = buildSnapshot(datasets, asArray, currentVersion);
  const previous = history.find(snapshot => snapshot.version !== current.version) || null;
  const changed = [];
  const added = [];
  const removed = [];

  if (previous) {
    const names = new Set([...Object.keys(previous.datasets), ...Object.keys(current.datasets)]);
    for (const name of [...names].sort()) {
      const before = Number(previous.datasets[name] || 0);
      const after = Number(current.datasets[name] || 0);
      if (!(name in previous.datasets)) added.push(name);
      if (!(name in current.datasets)) removed.push(name);
      if (before !== after) changed.push({ dataset: name, before, after, delta: after - before });
    }
  }

  return {
    current,
    previous,
    historyCount: history.length,
    hasHistory: Boolean(previous),
    changes: {
      datasets: changed,
      added,
      removed,
    },
    message: previous
      ? 'Changes are calculated from the latest stored snapshot.'
      : 'No previous snapshot is available yet. Changes will appear after the next stored snapshot.',
  };
}

module.exports = { buildSnapshot, getSnapshotHistory, buildChanges };
