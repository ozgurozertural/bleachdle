// Arayüz dili. Diğer tüm scriptlerden ÖNCE yüklenmeli: t() onlardan çağrılıyor.
//
// Dil değişince sayfa yeniden yükleniyor. Çalışma anında üretilen içerik çok
// (tahmin satırları, sonuç paneli, replik metni); hepsini yerinde çevirmek
// yerine yeniden çizdirmek hem basit hem de kesin. Günlük ilerleme zaten
// localStorage'da, kayıp olmuyor.

const LANG_KEY = 'bleachdle-lang';
const WIKI = '<a href="https://bleach.fandom.com" target="_blank" rel="noopener">Bleach Wiki</a>';

const DICT = {
  tr: {
    'lang.short': 'TR', 'lang.aria': 'Dil seç', 'lang.tr': 'Türkçe', 'lang.en': 'English',
    'theme.aria': 'Tema değiştir', 'brand.aria': 'Ana sayfa', 'nav.aria': 'Modlar',
    'back': '← Ana menü',

    'title.index': 'Bleachdle — Bleach karakter tahmin oyunu',
    'title.classic': 'Bleachdle — Classic Mode',
    'title.quote': 'Bleachdle — Quote Mode',
    'title.splash': 'Bleachdle — Splash Mode',
    'title.bankai': 'Bleachdle — Bankai Mode',

    'tagline': 'Her gün yeni bir <strong>Bleach</strong> karakteri. Kaç denemede bileceksin?',
    'card.classic': 'Karakter tahmin et. Her denemede özellik ipuçları al.',
    'card.quote': 'Ünlü bir replikten karakteri bul.',
    'card.splash': 'Bulanık görsel her denemede biraz daha netleşir.',
    'card.bankai': 'Bankai/Shikai formundan sahibini tahmin et.',
    'stats.title': 'İstatistiklerin',
    'stats.streak': 'Seri', 'stats.best': 'Rekor', 'stats.played': 'Oyun', 'stats.winrate': 'Kazanma',
    'footer.long': `Fan proje · Karakter verisi ve görseller ${WIKI}'den · Tite Kubo &copy; Shueisha`,
    'footer.short': `Fan proje · ${WIKI}`,

    'sub.classic': 'Bir Bleach karakteri tahmin et. Her tahmin sana yeni ipuçları verir.',
    'sub.quote': 'Bu repliği kim söyledi?',
    'sub.splash': 'Bulanık görsel her denemede biraz daha netleşir.',
    'sub.bankai': 'Bu Bankai / Shikai / Resurrección kime ait?',

    'daily.classic': 'Günün karakteri', 'daily.quote': 'Günün repliği',
    'daily.splash': 'Günün görseli', 'daily.bankai': "Günün bankai'si",
    'free': 'Serbest oyun',
    'search.placeholder': 'Karakter adı yazın...',

    'th.image': 'Görsel', 'th.name': 'İsim', 'th.gender': 'Cinsiyet', 'th.race': 'Irk',
    'th.age': 'Yaş', 'th.height': 'Boy', 'th.hair': 'Saç Rengi',
    'th.location': 'Bölge', 'th.arc': 'İlk Arc',

    'attempts': 'Kalan hak: <strong>{left}</strong> / {max}',
    'attempts.tried': '· Denemeler: {names}',

    'result.win': 'Bildin', 'result.lose': 'Kaybettin',
    'result.found': "<strong>{name}</strong>'i <strong>{n}</strong> denemede buldun.",
    'result.answer': 'Doğru cevap: <strong>{name}</strong>',
    'result.stats': 'Seri: {streak} · Rekor: {best} · Oyun: {played}',
    'result.free': 'Serbest oyuna geç', 'result.again': 'Yeni oyun', 'result.home': 'Ana menü',

    'hint': 'İpucu', 'hint.last': 'Son ipucu',
    'hint.manga': 'Manga, bölüm <strong>{ch}</strong>',
    'hint.anime': 'Anime, bölüm <strong>{ch}</strong>',

    'quote.loading': 'Yükleniyor...',
    'quote.none': 'Bu karakter için replik verisi yok. Başka bir karakter seçiliyor...',
    'bankai.none': 'Bu karakter için bankai verisi yok.',
    'data.none.title': 'Karakter verisi yok',
    'data.none.body': 'data/characters.json bulunamadı. Scraper çalıştı mı?',
    'data.error': 'Karakter verisi yüklenemedi:',
  },

  en: {
    'lang.short': 'ENG', 'lang.aria': 'Choose language', 'lang.tr': 'Türkçe', 'lang.en': 'English',
    'theme.aria': 'Toggle theme', 'brand.aria': 'Home', 'nav.aria': 'Modes',
    'back': '← Home',

    'title.index': 'Bleachdle — Bleach character guessing game',
    'title.classic': 'Bleachdle — Classic Mode',
    'title.quote': 'Bleachdle — Quote Mode',
    'title.splash': 'Bleachdle — Splash Mode',
    'title.bankai': 'Bleachdle — Bankai Mode',

    'tagline': 'A new <strong>Bleach</strong> character every day. How few guesses can you do it in?',
    'card.classic': 'Guess the character. Every guess reveals attribute clues.',
    'card.quote': 'Name the character from a famous line.',
    'card.splash': 'A blurred image sharpens with every guess.',
    'card.bankai': 'Guess the owner from their Bankai or Shikai.',
    'stats.title': 'Your stats',
    'stats.streak': 'Streak', 'stats.best': 'Best', 'stats.played': 'Played', 'stats.winrate': 'Win rate',
    'footer.long': `Fan project · Character data and images from ${WIKI} · Tite Kubo &copy; Shueisha`,
    'footer.short': `Fan project · ${WIKI}`,

    'sub.classic': 'Guess a Bleach character. Every guess gives you new clues.',
    'sub.quote': 'Who said this line?',
    'sub.splash': 'The blurred image sharpens with every guess.',
    'sub.bankai': 'Whose Bankai / Shikai / Resurrección is this?',

    'daily.classic': "Today's character", 'daily.quote': "Today's line",
    'daily.splash': "Today's image", 'daily.bankai': "Today's bankai",
    'free': 'Free play',
    'search.placeholder': 'Type a character name...',

    'th.image': 'Image', 'th.name': 'Name', 'th.gender': 'Gender', 'th.race': 'Race',
    'th.age': 'Age', 'th.height': 'Height', 'th.hair': 'Hair',
    'th.location': 'Location', 'th.arc': 'First Arc',

    'attempts': 'Guesses left: <strong>{left}</strong> / {max}',
    'attempts.tried': '· Tried: {names}',

    'result.win': 'You got it', 'result.lose': 'You lost',
    'result.found': 'You found <strong>{name}</strong> in <strong>{n}</strong> guesses.',
    'result.answer': 'The answer was <strong>{name}</strong>',
    'result.stats': 'Streak: {streak} · Best: {best} · Played: {played}',
    'result.free': 'Switch to free play', 'result.again': 'New game', 'result.home': 'Home',

    'hint': 'Hint', 'hint.last': 'Final hint',
    'hint.manga': 'Manga, chapter <strong>{ch}</strong>',
    'hint.anime': 'Anime, episode <strong>{ch}</strong>',

    'quote.loading': 'Loading...',
    'quote.none': 'No quote data for this character. Picking another one...',
    'bankai.none': 'No bankai data for this character.',
    'data.none.title': 'No character data',
    'data.none.body': 'data/characters.json not found. Did the scraper run?',
    'data.error': 'Could not load character data:',
  },
};

const LANG = DICT[localStorage.getItem(LANG_KEY)] ? localStorage.getItem(LANG_KEY) : 'tr';

// Veri değerleri (cinsiyet, ırk, saç, bölge, arc, aidiyet) characters.json'da
// İngilizce duruyor — kazıma kaynağı wiki İngilizce. Çeviri veriye değil buraya
// yazılıyor: veri dosyaları scraper'la yeniden üretilebilir olmalı.
//
// Alan bazlı sözlük, çünkü aynı değer alana göre başka şey demek:
// "Soul Society" bölge olarak yer, arc olarak kavis adı.
// Sözlükte olmayan değer olduğu gibi gösterilir (yeni veri geldiğinde
// çeviri eksik kalır ama tablo bozulmaz).
const VALUES = {
  tr: {
    gender: { Male: 'Erkek', Female: 'Kadın', Unknown: 'Bilinmiyor' },
    race: {
      Human: 'İnsan', 'Mod Soul': 'Mod Ruh', Unknown: 'Bilinmiyor',
      // Shinigami / Quincy / Arrancar / Visored / Fullbringer: Türkçe kaynaklarda
      // da özel ad gibi kullanılıyor, çevrilmiyor.
    },
    hair: {
      Black: 'Siyah', Blonde: 'Sarışın', White: 'Beyaz', Brown: 'Kahverengi',
      Orange: 'Turuncu', Red: 'Kızıl', Purple: 'Mor', Green: 'Yeşil',
      Pink: 'Pembe', Blue: 'Mavi', Grey: 'Gri', Yellow: 'Sarı',
      None: 'Yok', Other: 'Diğer',
    },
    location: {
      'Soul Society': 'Ruh Toplumu', 'Karakura Town': 'Karakura Kasabası',
      'Naruki City': 'Naruki Şehri', 'Soul King Palace': 'Ruh Kralı Sarayı',
      Other: 'Diğer',
      // Hueco Mundo, Wandenreich: özel ad.
    },
    first_arc: {
      Substitute: 'Vekil Shinigami', 'Soul Society': 'Ruh Toplumu',
      'Fake Karakura': 'Sahte Karakura', TYBW: 'Bin Yıllık Kan Savaşı',
      // Arrancar, Fullbring: özel ad.
    },
    affiliation: { Other: 'Diğer' },
  },
  en: {},
};

// Bir veri değerini arayüz diline çevirir. Bilinmeyen alan/değer olduğu gibi döner.
function tv(field, value) {
  const table = VALUES[LANG][field];
  return (table && table[value]) || value;
}

document.documentElement.lang = LANG;

function t(key, vars) {
  let s = DICT[LANG][key];
  if (s == null) return key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
  return s;
}

// data-i18n: metin, data-i18n-html: biçimli metin, ayrıca placeholder ve aria-label.
function applyI18n(root) {
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  r.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

applyI18n();

// Dil seçici
(function () {
  const box = document.querySelector('.lang-select');
  if (!box) return;
  const btn = box.querySelector('.lang-btn');
  const menu = box.querySelector('.lang-menu');

  function close() { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = box.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('[data-lang]').forEach(el => {
    el.setAttribute('aria-selected', String(el.dataset.lang === LANG));
    el.addEventListener('click', () => {
      if (el.dataset.lang === LANG) return close();
      localStorage.setItem(LANG_KEY, el.dataset.lang);
      location.reload();
    });
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
