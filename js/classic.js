(async function() {
  await window.CHARACTERS_READY;
  const chars = window.CHARACTERS;
  if (!chars.length) {
    document.getElementById('result').innerHTML =
      '<div class="result-panel lose"><h2>Karakter verisi yok</h2><p>data/characters.json bulunamadı. Scraper çalıştı mı?</p></div>';
    return;
  }

  const COLUMNS = [
    { key: 'İsim',      field: 'name'      },
    { key: 'Cinsiyet',  field: 'gender'    },
    { key: 'Irk',       field: 'race'      },
    { key: 'Yaş',       field: 'age'       },
    { key: 'Boy',       field: 'height_cm' },
    { key: 'Saç Rengi', field: 'hair'      },
    { key: 'Bölge',     field: 'location'  },
    { key: 'İlk Arc',   field: 'first_arc' },
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
    // console.log('[dev] answer:', state.answer.name);
  }

  function onGuess(c) {
    if (state.finished) return;
    if (state.guesses.find(g => g.id === c.id)) return;
    state.guesses.push(c);
    guessesEl.prepend(renderGuessRow(c, state.answer, COLUMNS));

    if (c.id === state.answer.id) return endRound(true);
    if (state.guesses.length >= state.maxGuesses) return endRound(false);
  }

  function endRound(won) {
    state.finished = true;
    input.disabled = true;
    const stats = recordGame('classic', won, state.guesses.length);
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
          ${state.mode === 'free'
            ? `<button id="again">Yeni oyun</button>`
            : `<button id="again" class="secondary">Serbest oyuna geç</button>`}
          <a class="secondary" href="index.html" style="padding:0.6rem 1.2rem;border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text)">Ana menü</a>
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
