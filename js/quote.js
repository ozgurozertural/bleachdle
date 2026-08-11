// Quote modu: replikten karakter. simple-mode iskeletini kullanır.

const QUOTES = fetch('data/quotes.json').then(r => r.json()).catch(() => ({}));
const SOURCES = fetch('data/quote_sources.json').then(r => r.json()).catch(() => ({}));
const MAX = 7;
const HINT_AT = MAX - 3;   // son 3 hak kalınca repliğin kaynağı açılır

initSimpleMode({
  modeKey: 'quote',
  maxGuesses: MAX,
  // Havuz yalnızca kaynağı doğrulanmış repliklerle sınırlı: ipucu her turda
  // verilebilsin diye. Kaynağı olmayan replikler quotes.json'da duruyor.
  pool: async (chars) => {
    const [q, src] = await Promise.all([QUOTES, SOURCES]);
    return chars.filter(c => q[c.id] && src[c.id]);
  },
  loadPrompt: async (answer) => {
    // İngilizcede repliğin wiki'deki aslı gösterilir; Türkçe çeviri quotes.json'da.
    const [q, src] = await Promise.all([QUOTES, SOURCES]);
    const text = LANG === 'en' ? (src[answer.id] || {}).en : q[answer.id];
    document.getElementById('quote-hint-slot').innerHTML = '';
    document.getElementById('quote-display').innerHTML = text
      ? `“${esc(text)}”`
      : `<em>${t('quote.none')}</em>`;
    return !!text;
  },
  onGuess: async (guesses, answer, finished) => {
    // Son 3 hak kalınca repliğin hangi bölümde geçtiği açılır.
    if (finished || guesses.length < HINT_AT) return;
    const slot = document.getElementById('quote-hint-slot');
    if (slot.innerHTML) return;
    const s = (await SOURCES)[answer.id];
    if (!s) return;
    slot.innerHTML = `
      <div class="quote-hint">
        <span class="quote-hint-label">${t('hint')}</span>
        <span class="quote-hint-body">${t(s.kind === 'anime' ? 'hint.anime' : 'hint.manga', { ch: s.chapter })}</span>
      </div>`;
  }
});
