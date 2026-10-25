// Bankai modu: bankai/shikai/resurrección adından sahibi.

// 3. yanlıştan sonra salım çağrısının Japonca sesi ipucu olarak açılır.
const HINT_AT = 3;
const BANKAI = fetch('data/bankai.json').then(r => r.json()).catch(() => ({}));
const AUDIO = fetch('data/bankai_audio.json').then(r => r.json()).catch(() => null);

// Çalan klip. Yeni turda (serbest oyun) susturulsun diye modül düzeyinde.
let player = null, playerSrc = null;
function stopPlayer() {
  if (player) player.pause();
  player = playerSrc = null;
}

initSimpleMode({
  modeKey: 'bankai',
  maxGuesses: 8,
  // Havuz yalnız sesi olanlar: düğmenin bir karakterde çıkıp ötekinde
  // çıkmaması cevabı ele verirdi. Manifest yüklenemezse sessiz oynanır.
  pool: async (chars) => {
    const [b, a] = await Promise.all([BANKAI, AUDIO]);
    return chars.filter(c => b[c.id] && (!a || a[c.id]));
  },
  loadPrompt: async (answer) => {
    const b = (await BANKAI)[answer.id];
    const el = document.getElementById('quote-display');
    stopPlayer();
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
  onGuess: async (guesses, answer, finished) => {
    // Oyun bitince de açılır: cevabı duymak da ödülün parçası.
    if (!finished && guesses.length < HINT_AT) return;
    const slot = document.getElementById('bankai-hint-slot');
    if (slot.innerHTML) return;
    const clip = ((await AUDIO) || {})[answer.id];
    if (!clip) return;
    slot.innerHTML = `
      <div class="audio-hint">
        <button type="button" class="audio-play" aria-label="${t('audio.play')}">
          <span class="audio-icon" aria-hidden="true"></span>
        </button>
        <div class="audio-body">
          <span class="audio-label">${t('hint')}</span>
          <span class="audio-text">${t('audio.release')}</span>
          <span class="audio-track"><span class="audio-fill"></span></span>
        </div>
      </div>`;
    bindAudio(slot.querySelector('.audio-hint'), clip.file);
  }
});

function bindAudio(box, src) {
  const btn = box.querySelector('.audio-play');
  const fill = box.querySelector('.audio-fill');
  const text = box.querySelector('.audio-text');
  let raf = 0;

  // timeupdate saniyede ~4 kez geliyor, çizgi kesik kesik ilerlerdi.
  const tick = () => {
    if (!player || !player.duration) return;
    fill.style.transform = `scaleX(${player.currentTime / player.duration})`;
    raf = requestAnimationFrame(tick);
  };
  const setPlaying = (on) => {
    box.classList.toggle('is-playing', on);
    btn.setAttribute('aria-label', t(on ? 'audio.pause' : 'audio.play'));
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(tick);
  };

  btn.addEventListener('click', () => {
    if (player && box.classList.contains('is-playing')) {
      player.pause();
      return;
    }
    if (playerSrc !== src) {
      stopPlayer();
      player = new Audio(src);
      playerSrc = src;
      player.addEventListener('playing', () => setPlaying(true));
      player.addEventListener('pause', () => setPlaying(false));
      player.addEventListener('ended', () => {
        setPlaying(false);
        fill.style.transform = 'scaleX(1)';
      });
      player.addEventListener('error', () => {
        setPlaying(false);
        box.classList.add('is-error');
        text.textContent = t('audio.error');
      });
    }
    if (player.ended) player.currentTime = 0;
    // Eski tarayıcılarda play() Promise döndürmüyor.
    const p = player.play();
    if (p) p.catch(() => {});
  });
}
