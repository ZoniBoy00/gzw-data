const SMART_ROUTES = {
  armor: {
    sources: ['vests', 'helmets', 'glasses'],
    label: 'Armor (vests + helmets + glasses)',
    mutators: {
      vests: item => ({ ...item, category: 'vest' }),
      helmets: item => ({ ...item, category: 'helmet' }),
      glasses: item => ({ ...item, category: 'glasses' }),
    },
  },
  weapon_parts: {
    sources: [
      'barrels', 'muzzle_devices', 'suppressors', 'stocks',
      'stock_adapters', 'pistol_grips', 'foregrips', 'magazines',
      'night_vision', 'helmet_mods', 'helmet_mounts', 'weapon_parts',
    ],
    label: 'Weapon parts (combined)',
    mutators: {},
    defaultMutator: (item, source) => ({ ...item, part_category: source }),
  },
  helmet_mods: {
    sources: ['night_vision', 'helmet_mounts'],
    label: 'Helmet mods (night vision + mounts)',
    mutators: {
      night_vision: item => ({ ...item, mod_type: 'night_vision' }),
      helmet_mounts: item => ({ ...item, mod_type: 'mount' }),
    },
  },
};

function getSmartData(name, asArray) {
  const route = SMART_ROUTES[name];
  if (!route) return null;

  let items = [];
  for (const source of route.sources) {
    const data = asArray(source);
    const mutator = route.mutators?.[source] || route.defaultMutator;
    items = items.concat(data.map(item => mutator ? mutator(item, source) : item));
  }

  const seen = new Set();
  return items.filter(item => {
    const key = item.name?.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { SMART_ROUTES, getSmartData };
