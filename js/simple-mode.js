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
    const saved = loadDaily(modeKey, dayIndex());
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
    saveDaily(modeKey, dayIndex(), state.guesses.map(g => g.id), finished, won);
  }

  function updateAttempts() {
    attemptsEl.innerHTML = `
      Kalan hak: <strong>${state.maxGuesses - state.guesses.length}</strong> / ${state.maxGuesses}
      ${state.guesses.length ? '· Denemeler: ' + state.guesses.map(g => g.name).join(', ') : ''}
    `;
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
        <h2>${won ? '🎉 Bildin!' : '💀 Kaybettin'}</h2>
        <p>${won
          ? `<strong>${state.answer.name}</strong>'i <strong>${state.guesses.length}</strong> denemede buldun.`
          : `Doğru cevap: <strong>${state.answer.name}</strong>`}</p>
        <p style="color:var(--text-muted);font-size:0.9rem">
          Seri: ${stats.streak} · Rekor: ${stats.maxStreak} · Oyun: ${stats.played}
        </p>
        <div class="result-actions">
          <button id="again">${state.mode === 'daily' ? 'Serbest oyuna geç' : 'Yeni oyun'}</button>
          <a class="secondary" href="index.html" style="padding:0.6rem 1.2rem;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text)">Ana menü</a>
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
