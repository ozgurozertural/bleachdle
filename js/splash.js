// Splash modu: bulanık görsel her yanlışta netleşir.

const MAX = 6;
// Splash kendi görsel setini kullanır: tahmin tablosundaki ve otomatik
// tamamlamadaki profil görselinin aynısı gösterilince oyun tahmin olmaktan
// çıkıp eşleştirmeye dönüyordu.
const SPLASH = fetch('data/splash.json').then(r => r.json()).catch(() => ({}));

initSimpleMode({
  modeKey: 'splash',
  maxGuesses: MAX,
  pool: async (chars) => {
    const sp = await SPLASH;
    return chars.filter(c => sp[c.id]);
  },
  loadPrompt: async (answer) => {
    const src = (await SPLASH)[answer.id];
    const img = document.getElementById('splash-img');
    img.src = src || '';
    img.style.filter = 'blur(28px)';
    return !!src;
  },
  onGuess: (guesses, answer, finished) => {
    const img = document.getElementById('splash-img');
    if (finished) { img.style.filter = 'blur(0)'; return; }
    // her yanlış tahminde bulanıklık azalır: 28 -> 22 -> 16 -> 10 -> 5 -> 0
    const blur = Math.max(0, 28 - guesses.length * 5);
    img.style.filter = `blur(${blur}px)`;
  }
});
