// Characters JSON is loaded async; games await window.CHARACTERS_READY.

window.CHARACTERS = [];
window.CHARACTERS_READY = Promise.all([
  fetch('data/characters.json').then(r => r.json()),
  fetch('data/overrides.json').then(r => r.json()).catch(() => ({}))
])
  .then(([list, overrides]) => {
    // Apply per-character overrides on top of scraped data.
    for (const c of list) {
      const o = overrides[c.id];
      if (!o) continue;
      for (const [k, v] of Object.entries(o)) {
        if (v != null) c[k] = v;
      }
    }
    // Yaş kovası: sayısal yaştan türetilir, yoksa override'daki age_group kullanılır.
    for (const c of list) {
      c.age_group = ageBucket(c.age) || c.age_group || null;
    }
    window.CHARACTERS = list;
    return list;
  })
  .catch(e => {
    console.error(t('data.error'), e);
    return [];
  });
