(async function() {
  await window.CHARACTERS_READY;
  const chars = window.CHARACTERS;
  if (!chars.length) {
    document.getElementById('result').innerHTML =
      `<div class="result-panel lose"><h2>${t('data.none.title')}</h2><p>${t('data.none.body')}</p></div>`;
    return;
  }

  // Sıra classic.html'deki <thead> ile eşleşmeli; başlık metinleri orada.
  const COLUMNS = [
    { field: 'name' }, { field: 'gender' }, { field: 'race' }, { field: 'age_group' },
    { field: 'height_cm' }, { field: 'hair' }, { field: 'location' }, { field: 'first_arc' },
  ];

  const state = {
    mode: 'daily',
    answer: null,
    guesses: [],
    finished: false,
    maxGuesses: 8,
  };

  const guessesEl = document.getElementById('guesses');
  const resultEl = document.getElementById('result');
  const input = document.getElementById('search');
  const suggestBox = document.getElementById('suggestions');

  function newRound() {
    state.guesses = [];
    state.finished = false;
    guessesEl.innerHTML = '';
    resultEl.innerHTML = '';
    input.disabled = false;
    input.value = '';
    input.focus();
    state.answer = state.mode === 'daily'
      ? pickDaily(chars, 'classic')
      : pickRandom(chars);
    if (state.mode === 'daily') restoreDaily();
    // console.log('[dev] answer:', state.answer.name);
  }

  // Aynı günün kaydedilmiş tahminlerini geri yükler; oyun bitmişse sonucu da gösterir
  // (istatistik ikinci kez işlenmez).
  function restoreDaily() {
    const saved = loadDaily('classic', dayIndex());
    if (!saved) return;
    for (const id of saved.guesses) {
      const c = chars.find(x => x.id === id);
      if (!c) continue;
      state.guesses.push(c);
      guessesEl.prepend(renderGuessRow(c, state.answer, COLUMNS));
    }
    if (saved.finished) endRound(saved.won, true);
  }

  function persist(finished, won) {
    if (state.mode !== 'daily') return;
    saveDaily('classic', dayIndex(), state.guesses.map(g => g.id), finished, won);
  }

  function onGuess(c) {
    if (state.finished) return;
    if (state.guesses.find(g => g.id === c.id)) return;
    state.guesses.push(c);
    guessesEl.prepend(renderGuessRow(c, state.answer, COLUMNS));

    if (c.id === state.answer.id) return endRound(true);
    if (state.guesses.length >= state.maxGuesses) return endRound(false);
    persist(false, false);
  }

  // replay: kayıttan geri yükleme — skor yeniden işlenmez.
  function endRound(won, replay) {
    state.finished = true;
    input.disabled = true;
    persist(true, won);
    const stats = state.mode === 'daily' && !replay
      ? recordGame('classic', won, state.guesses.length, dayIndex())
      : getModeStats('classic');
    resultEl.innerHTML = `
      <div class="result-panel ${won ? 'win' : 'lose'}">
        <h2>${won ? t('result.win') : t('result.lose')}</h2>
        <p>${won
          ? t('result.found', { name: state.answer.name, n: state.guesses.length })
          : t('result.answer', { name: state.answer.name })}</p>
        <p class="result-stats">
          ${t('result.stats', { streak: stats.streak, best: stats.maxStreak, played: stats.played })}
        </p>
        <div class="result-actions">
          ${state.mode === 'free'
            ? `<button id="again">${t('result.again')}</button>`
            : `<button id="again" class="secondary">${t('result.free')}</button>`}
          <a class="secondary" href="index.html">${t('result.home')}</a>
        </div>
      </div>
    `;
    const again = document.getElementById('again');
    if (again) again.addEventListener('click', () => {
      if (state.mode === 'daily') switchMode('free');
      else newRound();
    });
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
    onPick: onGuess,
  });

  newRound();
})();
