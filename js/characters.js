// Karakter listesi: Classic'teki bütün karakterler ve oyunun onlar için
// kullandığı değerler. Takılan oyuncu wiki'ye gitmek yerine buraya bakar;
// White/Grey ayrımı, yaş aralıkları gibi bizim veri kararlarımız da burada
// görünür olur.
//
// Bilerek yalnız Classic alanları: replik, salım adı ya da splash görseli
// burada olsaydı öteki üç modun cevap anahtarı olurdu. Tahminlerden aday
// eleyen bir "çözücü" de yok — sıralama ve filtre var, elemeyi oyuncu yapar.

// Sıralı alanlar mantıksal sırayla (yaş küçükten büyüğe, arc hikâye sırasıyla)
// sıralanıp filtrelenir; ötekiler arayüz dilindeki adına göre.
const LIST_FIELDS = [
  { field: 'gender', th: 'th.gender' },
  { field: 'race', th: 'th.race' },
  { field: 'age_group', th: 'th.age', order: AGE_BUCKETS },
  { field: 'hair', th: 'th.hair' },
  { field: 'location', th: 'th.location' },
  { field: 'first_arc', th: 'th.arc', order: ARC_ORDER },
];
const ORDERS = Object.fromEntries(LIST_FIELDS.filter(f => f.order).map(f => [f.field, f.order]));
const COLLATOR = new Intl.Collator(LANG, { sensitivity: 'base', numeric: true });

(async function () {
  await window.CHARACTERS_READY;
  const chars = window.CHARACTERS;
  const body = document.getElementById('list-body');
  const countEl = document.getElementById('list-count');
  const emptyEl = document.getElementById('list-empty');
  const resetBtn = document.getElementById('list-reset');
  const search = document.getElementById('list-search');
  const filtersEl = document.getElementById('list-filters');
  if (!chars.length) {
    countEl.innerHTML = t('data.none.title');
    return;
  }

  const state = { q: '', filters: {}, sort: 'name', dir: 1 };

  // Filtre seçicileri veriden: yeni bir saç rengi gelirse seçenek kendiliğinden çıkar.
  filtersEl.innerHTML = LIST_FIELDS.map(({ field, th, order }) => {
    const values = [...new Set(chars.map(c => c[field]).filter(v => v != null))];
    values.sort(order
      ? (a, b) => order.indexOf(a) - order.indexOf(b)
      : (a, b) => COLLATOR.compare(tv(field, a), tv(field, b)));
    return `
      <label class="list-filter">
        <span>${t(th)}</span>
        <select data-field="${field}">
          <option value="">${t('list.all')}</option>
          ${values.map(v => `<option value="${esc(v)}">${esc(tv(field, v))}</option>`).join('')}
        </select>
      </label>`;
  }).join('');

  function sortValue(c, field) {
    const v = c[field];
    if (v == null) return null;
    if (ORDERS[field]) return ORDERS[field].indexOf(v);
    if (field === 'height_cm') return v;
    return tv(field, v);
  }

  function compare(a, b) {
    const va = sortValue(a, state.sort), vb = sortValue(b, state.sort);
    // Boş değer (boyu bilinmeyenler) yön ne olursa olsun en sonda
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    const r = typeof va === 'number' ? va - vb : COLLATOR.compare(va, vb);
    return r * state.dir || COLLATOR.compare(a.name, b.name);
  }

  function cell(c, field) {
    const v = c[field];
    return v == null ? '—' : esc(tv(field, v));
  }

  function render() {
    const q = norm(state.q);
    const rows = chars.filter(c =>
      (!q || norm(c.name).includes(q)) &&
      Object.entries(state.filters).every(([f, v]) => !v || c[f] === v)
    ).sort(compare);

    body.innerHTML = rows.map(c => `
      <tr>
        <td class="image-cell">${c.image
          ? `<img class="char-avatar" src="${esc(c.image)}" alt="" loading="lazy" decoding="async">`
          : '<div class="char-avatar img-missing">?</div>'}</td>
        <td class="name-cell">${esc(c.name)}</td>
        <td>${cell(c, 'gender')}</td>
        <td>${cell(c, 'race')}</td>
        <td>${cell(c, 'age_group')}</td>
        <td>${cell(c, 'height_cm')}</td>
        <td>${cell(c, 'hair')}</td>
        <td>${cell(c, 'location')}</td>
        <td>${cell(c, 'first_arc')}</td>
      </tr>`).join('');

    countEl.innerHTML = t('list.count', { n: rows.length, total: chars.length });
    emptyEl.hidden = rows.length > 0;
    resetBtn.hidden = !state.q && !Object.values(state.filters).some(Boolean);

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.setAttribute('aria-sort', th.dataset.sort === state.sort
        ? (state.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  search.addEventListener('input', () => { state.q = search.value; render(); });
  filtersEl.addEventListener('change', e => {
    const sel = e.target.closest('select');
    if (!sel) return;
    state.filters[sel.dataset.field] = sel.value;
    sel.classList.toggle('is-set', !!sel.value);
    render();
  });
  document.querySelectorAll('th[data-sort] button').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.parentElement.dataset.sort;
      state.dir = state.sort === f ? -state.dir : 1;
      state.sort = f;
      render();
    });
  });
  resetBtn.addEventListener('click', () => {
    state.q = search.value = '';
    state.filters = {};
    filtersEl.querySelectorAll('select').forEach(s => { s.value = ''; s.classList.remove('is-set'); });
    render();
    search.focus();
  });

  render();
})();
