// Ortak oyun mantığı: günlük seed, autocomplete, karşılaştırma.

// Deterministik string hash (FNV-1a)
function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Gün sayacı (yerel gün başlangıcına göre, DST'den etkilenmez)
const EPOCH_UTC = Date.UTC(2026, 0, 1);
function dayIndex() {
  const d = new Date();
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC) / 86400000);
}

// Seed'lenebilir PRNG (mulberry32) — deterministik karıştırma için
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledOrder(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Bir devrin sırası: liste deterministik karıştırılır, gün gün tüketilir.
// Devir sınırında kısa aralıklı tekrar olmasın diye yeni devrin ilk çeyreği,
// önceki devrin son çeyreğiyle takas edilerek çakışmadan arındırılır.
const cycleCache = new Map();
function cycleOrder(mode, n, cycle) {
  const key = mode + '|' + n + '|' + cycle;
  if (cycleCache.has(key)) return cycleCache.get(key);

  const order = shuffledOrder(n, fnv1a(key));
  const guard = Math.floor(n / 4);
  if (cycle > 0 && guard > 0) {
    const prevTail = new Set(cycleOrder(mode, n, cycle - 1).slice(n - guard));
    let swap = n - 1;
    for (let i = 0; i < guard; i++) {
      if (!prevTail.has(order[i])) continue;
      while (swap > i && prevTail.has(order[swap])) swap--;
      if (swap <= i) break;
      [order[i], order[swap]] = [order[swap], order[i]];
      swap--;
    }
  }
  cycleCache.set(key, order);
  return order;
}

function pickDaily(list, mode) {
  const n = list.length;
  const day = dayIndex();
  const cycle = Math.floor(day / n);
  return list[cycleOrder(mode, n, cycle)[((day % n) + n) % n]];
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Normalize a query for autocomplete matching
function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function setupAutocomplete({input, suggestBox, chars, onPick, excludeIds}) {
  let filtered = [];
  let cursor = -1;

  function render() {
    if (!filtered.length) { suggestBox.classList.remove('open'); return; }
    suggestBox.innerHTML = filtered.slice(0, 8).map((c, i) => `
      <div class="suggestion${i === cursor ? ' active' : ''}" data-id="${esc(c.id)}">
        ${c.image ? `<img src="${esc(c.image)}" alt="">` : `<div class="suggestion img-placeholder"></div>`}
        <div>
          <div class="sname">${esc(c.name)}</div>
          <div class="saff">${c.affiliation ? esc(tv('affiliation', c.affiliation)) : ''}</div>
        </div>
      </div>
    `).join('');
    suggestBox.classList.add('open');
    suggestBox.querySelectorAll('.suggestion').forEach(el => {
      el.addEventListener('click', () => {
        const c = chars.find(x => x.id === el.dataset.id);
        if (c) commit(c);
      });
    });
  }

  function commit(c) {
    input.value = '';
    filtered = [];
    cursor = -1;
    suggestBox.classList.remove('open');
    onPick(c);
  }

  input.addEventListener('input', () => {
    const q = norm(input.value);
    if (!q) { filtered = []; suggestBox.classList.remove('open'); return; }
    const ex = new Set(excludeIds ? excludeIds() : []);
    filtered = chars.filter(c => !ex.has(c.id) && norm(c.name).includes(q));
    cursor = -1;
    render();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      cursor = Math.min(cursor + 1, Math.min(filtered.length, 8) - 1); render(); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      cursor = Math.max(cursor - 1, 0); render(); e.preventDefault();
    } else if (e.key === 'Enter') {
      if (cursor >= 0 && filtered[cursor]) commit(filtered[cursor]);
      else if (filtered.length) commit(filtered[0]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      filtered = []; suggestBox.classList.remove('open');
    }
  });
  document.addEventListener('click', e => {
    if (!suggestBox.contains(e.target) && e.target !== input) {
      suggestBox.classList.remove('open');
    }
  });
}

// Sütun karşılaştırma. answer alanı ile guess alanını karşılaştırır.
// Döner: {cls: 'correct'|'partial'|'wrong', display: '...', arrow?: '↑'|'↓'}
// Yakın ırklar (Loldle'daki "kısmi" sarı için).
const RACE_GROUPS = [
  new Set(['Shinigami', 'Visored']),
  new Set(['Hollow', 'Arrancar']),
  new Set(['Human', 'Fullbringer', 'Quincy']),
];

function racePartial(a, g) {
  if (!a || !g) return false;
  return RACE_GROUPS.some(gr => gr.has(a) && gr.has(g));
}

// Bleach ana kavis sırası — "İlk Arc" için yakınlık karşılaştırması.
const ARC_ORDER = ['Substitute','Soul Society','Arrancar','Fake Karakura','Fullbring','TYBW'];

function arcPartial(a, g) {
  const ai = ARC_ORDER.indexOf(a), gi = ARC_ORDER.indexOf(g);
  if (ai < 0 || gi < 0) return false;
  return Math.abs(ai - gi) === 1;
}

// Yaş kovaları. Karakterlerin yarısından fazlasının kanonik sayısal yaşı yok;
// sayısal yaş yerine aralık karşılaştırılır. Sıralı liste, ↑↓ oku için de kullanılır.
const AGE_BUCKETS = ['1-20', '21-40', '41-60', '61-100', '101-1000', '1000+'];

// Sayısal yaşı kovaya çevirir. Yaş yoksa null (overrides'taki age_group devreye girer).
function ageBucket(age) {
  if (age == null) return null;
  if (age <= 20) return '1-20';
  if (age <= 40) return '21-40';
  if (age <= 60) return '41-60';
  if (age <= 100) return '61-100';
  if (age <= 1000) return '101-1000';
  return '1000+';
}

// Sıralı liste üzerinden karşılaştırma: eşitse yeşil, değilse ok yönü.
function ordinalCompare(order, a, g) {
  if (a === g && a) return { cls: 'correct', display: g };
  const ai = order.indexOf(a), gi = order.indexOf(g);
  if (ai < 0 || gi < 0) return { cls: 'wrong', display: g || '?' };
  return { cls: 'wrong', display: g, arrow: gi < ai ? '↑' : '↓' };
}

// Sayısal alanlar: yakınsa sarı + ok göster.
function numericCompare(a, g /* tolerance kaldırıldı: sarı yok */) {
  if (a == null || g == null) return { cls: 'wrong', display: g == null ? '?' : String(g) };
  if (a === g) return { cls: 'correct', display: String(g) };
  return { cls: 'wrong', display: String(g), arrow: g < a ? '↑' : '↓' };
}

function compareField(field, answer, guess) {
  const a = answer[field];
  const g = guess[field];

  if (field === 'name') {
    return { cls: a === g ? 'correct' : 'wrong', display: g };
  }
  if (field === 'age_group') return ordinalCompare(AGE_BUCKETS, a, g);
  if (field === 'height_cm') return numericCompare(a, g);
  if (field === 'division')  return numericCompare(a, g);

  if (field === 'has_bankai') {
    const av = !!a, gv = !!g;
    return { cls: av === gv ? 'correct' : 'wrong', display: gv ? '✓' : '✗' };
  }

  if (field === 'race') {
    if (a === g && a) return { cls: 'correct', display: g };
    return { cls: 'wrong', display: g || '—' };
  }

  if (field === 'first_arc') {
    if (a === g && a) return { cls: 'correct', display: g };
    const ai = ARC_ORDER.indexOf(a), gi = ARC_ORDER.indexOf(g);
    if (ai < 0 || gi < 0) return { cls: 'wrong', display: g || '—' };
    return { cls: 'wrong', display: g, arrow: gi < ai ? '↑' : '↓' };
  }

  if (a === g && a) return { cls: 'correct', display: g || '—' };
  return { cls: 'wrong', display: g || '—' };
}

// Bir tahmin satırı üretir. İlk sütun her zaman avatar; sonraki sütunlar columns'tan gelir.
function renderGuessRow(guess, answer, columns) {
  const tr = document.createElement('tr');

  const imgTd = document.createElement('td');
  imgTd.className = 'image-cell';
  imgTd.style.setProperty('--col', 0);
  imgTd.innerHTML = guess.image
    ? `<img class="char-avatar" src="${esc(guess.image)}" alt="${esc(guess.name)}">`
    : '<div class="char-avatar img-missing">?</div>';
  tr.appendChild(imgTd);

  columns.forEach((col, i) => {
    const td = document.createElement('td');
    const cmp = compareField(col.field, answer, guess);
    td.className = cmp.cls + (col.field === 'name' ? ' name-cell' : '');
    td.style.setProperty('--col', i + 1);
    // Değer çevirisi tek noktada: compareField karşılaştırmayı hep İngilizce
    // veri üstünde yapar, dile çeviri sadece ekrana basarken olur.
    td.innerHTML = (cmp.display == null ? '—' : esc(tv(col.field, cmp.display))) +
      (cmp.arrow ? `<span class="arrow">${cmp.arrow}</span>` : '');
    tr.appendChild(td);
  });
  return tr;
}
