// Quote/Splash/Bankai gibi tek-tahmin modları için ortak scaffold.
// classic'ten farklı: özellik tablosu yok, sadece doğru mu değil mi.

// `pool` (optional) narrows the answer set to characters this mode has data for —
// e.g. Bankai mode can only ask about characters that have a release name.
async function initSimpleMode({ modeKey, maxGuesses = 5, pool, loadPrompt, onGuess }) {
  await window.CHARACTERS_READY;
  const chars = window.CHARACTERS;
  if (!chars.length) return;

  const answerPool = pool ? await pool(chars) : chars;
  if (!answerPool.length) return;

  const state = {
    mode: 'daily',
    answer: null,
    guesses: [],
    finished: false,
    maxGuesses,
  };

  const resultEl = document.getElementById('result');
  const attemptsEl = document.getElementById('attempts');
  const guessListEl = document.getElementById('guess-list');
  const input = document.getElementById('search');
  const suggestBox = document.getElementById('suggestions');

  async function pickAnswer() {
    // Havuz zaten yalnızca bu modun verisine sahip karakterlerden oluşuyor;
    // yine de loadPrompt false dönerse (bozuk kayıt) başka bir aday denenir.
    let tries = 0;
    while (tries++ < 20) {
      state.answer = state.mode === 'daily'
        ? pickDaily(answerPool, modeKey + (tries > 1 ? '-' + tries : ''))
        : pickRandom(answerPool);
      if (await loadPrompt(state.answer) !== false) return;
    }
  }

  async function newRound() {
    state.guesses = [];
    state.finished = false;
    resultEl.innerHTML = '';
    if (guessListEl) guessListEl.innerHTML = '';
    input.disabled = false;
    input.value = '';
    await pickAnswer();
    if (state.mode === 'daily') restoreDaily();
    updateAttempts();
    input.focus();
    // console.log('[dev] answer:', state.answer && state.answer.name);
  }

  // Aynı günün kaydedilmiş tahminlerini geri yükler. onGuess bir kez çağrılır ki
  // moda özel ipucu durumu (splash bulanıklığı, bankai görseli) doğru seviyeye gelsin.
  function restoreDaily() {
    const saved = loadDaily(modeKey, dayIndex(), state.answer.id);
    if (!saved) return;
    for (const id of saved.guesses) {
      const c = chars.find(x => x.id === id);
      if (c) state.guesses.push(c);
    }
    if (onGuess) onGuess(state.guesses, state.answer, saved.finished);
    if (saved.finished) endRound(saved.won, true);
  }

  function persist(finished, won) {
    if (state.mode !== 'daily') return;
    saveDaily(modeKey, dayIndex(), state.answer.id, state.guesses.map(g => g.id), finished, won);
  }

  function updateAttempts() {
    attemptsEl.innerHTML =
      t('attempts', { left: state.maxGuesses - state.guesses.length, max: state.maxGuesses });
    renderGuesses();
  }

  // Denenen karakterler ad listesi yerine görselli kartlar. En yeni üstte —
  // classic'teki tahmin tablosunun sırasıyla aynı. Liste her seferinde baştan
  // çiziliyor: kayıttan geri yükleme de aynı yoldan geçsin diye.
  function renderGuesses() {
    if (!guessListEl) return;
    guessListEl.innerHTML = state.guesses.map((g, i) => {
      const hit = state.answer && g.id === state.answer.id;
      const col = state.guesses.length - 1 - i;
      return `
        <li class="guess-item ${hit ? 'correct' : 'wrong'}" style="--col:${col}">
          ${g.image
            ? `<img class="char-avatar" src="${esc(g.image)}" alt="">`
            : '<span class="char-avatar img-missing">?</span>'}
          <span class="guess-name">${esc(g.name)}</span>
        </li>`;
    }).reverse().join('');
  }

  // replay: kayıttan geri yükleme — skor yeniden işlenmez.
  function endRound(won, replay) {
    state.finished = true;
    input.disabled = true;
    persist(true, won);
    const stats = state.mode === 'daily' && !replay
      ? recordGame(modeKey, won, state.guesses.length, dayIndex())
      : getModeStats(modeKey);
    resultEl.innerHTML = `
      <div class="result-panel ${won ? 'win' : 'lose'}">
        <h2>${won ? t('result.win') : t('result.lose')}</h2>
        <div class="answer-reveal">
          ${state.answer.image
            ? `<img class="char-avatar" src="${esc(state.answer.image)}" alt="${esc(state.answer.name)}">`
            : '<span class="char-avatar img-missing">?</span>'}
          <div>
            <p>${won
              ? t('result.found', { name: state.answer.name, n: state.guesses.length })
              : t('result.answer', { name: state.answer.name })}</p>
            <p class="result-stats">
              ${t('result.stats', { streak: stats.streak, best: stats.maxStreak, played: stats.played })}
            </p>
          </div>
        </div>
        <div class="result-actions">
          <button id="again">${state.mode === 'daily' ? t('result.free') : t('result.again')}</button>
          <a class="secondary" href="index.html">${t('result.home')}</a>
        </div>
      </div>
    `;
    document.getElementById('again').addEventListener('click', () => {
      if (state.mode === 'daily') switchMode('free');
      else newRound();
    });
  }

  function onPick(c) {
    if (state.finished) return;
    if (state.guesses.find(g => g.id === c.id)) return;
    state.guesses.push(c);
    updateAttempts();
    const won = c.id === state.answer.id;
    if (onGuess) onGuess(state.guesses, state.answer, won || state.guesses.length >= state.maxGuesses);
    if (won) return endRound(true);
    if (state.guesses.length >= state.maxGuesses) return endRound(false);
    persist(false, false);
  }

  function switchMode(m) {
    state.mode = m;
    document.querySelectorAll('.mode-switch button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    newRound();
  }

  document.querySelectorAll('.mode-switch button').forEach(b => {
    b.addEventListener('click', () => switchMode(b.dataset.mode));
  });

  setupAutocomplete({
    input, suggestBox, chars,
    excludeIds: () => state.guesses.map(g => g.id),
    onPick,
  });

  newRound();
}
