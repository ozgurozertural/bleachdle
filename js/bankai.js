// Bankai modu: bankai/shikai/resurrección adından sahibi.

const HINT_AT = 5;
const BANKAI = fetch('data/bankai.json').then(r => r.json()).catch(() => ({}));
initSimpleMode({
  modeKey: 'bankai',
  maxGuesses: 8,
  pool: async (chars) => {
    const b = await BANKAI;
    return chars.filter(c => b[c.id]);
  },
  loadPrompt: async (answer) => {
    const b = (await BANKAI)[answer.id];
    const el = document.getElementById('quote-display');
    document.getElementById('bankai-hint-slot').innerHTML = '';
    if (!b) { el.innerHTML = `<em>${t('bankai.none')}</em>`; return false; }
    el.innerHTML = `
      <div class="release-name">
        ${esc(b.name || '???')}
      </div>
      <div class="release-meta">
        ${esc(b.type || '')}${b.ability ? ' · ' + esc(b.ability) : ''}
      </div>`;
    return true;
  },
  onGuess: (guesses, answer, finished) => {
    // 5. yanlış tahminden sonra karakterin görseli ipucu olarak açılır (finish değilse)
    if (!finished && guesses.length >= HINT_AT && answer.image) {
      const slot = document.getElementById('bankai-hint-slot');
      if (!slot.innerHTML) {
        slot.innerHTML = `
          <div class="bankai-hint-label">${t('hint.last')}</div>
          <div class="bankai-hint">
            <img src="${esc(answer.image)}" alt="hint" class="hint-blur">
          </div>
        `;
      }
    }
  }
});
