# Bleachdle

Her gün yeni bir **Bleach** karakteri. Wordle/LoLdle tarzı, dört modlu günlük tahmin oyunu.

🎮 **[ozgurozertural.github.io/bleachdle](https://ozgurozertural.github.io/bleachdle/)**

| Mod | Ne soruyor | Hak |
| --- | --- | --- |
| **Classic** | Karakteri özellik ipuçlarıyla bul (cinsiyet, ırk, yaş, boy, saç, bölge, ilk arc) | 8 |
| **Quote** | Bu repliği kim söyledi? Son üç hakta bölüm ipucu açılır | 7 |
| **Splash** | Bulanık görsel her yanlışta biraz daha netleşir | 6 |
| **Bankai** | Bu Bankai / Shikai / Resurrección kime ait? | 8 |

Günün cevabı herkeste aynı: tarih damgasından türeyen deterministik bir sırayla
seçiliyor ve bir devir bitmeden hiçbir karakter tekrar etmiyor. İlerleme ve seri
kaydı tarayıcıda (`localStorage`) duruyor — hesap yok, sunucu yok.

Arayüz Türkçe ve İngilizce.

## Çalıştırma

Derleme adımı yok, düz statik dosyalar:

```bash
python3 -m http.server 8000
```

→ `http://localhost:8000`

## Yapı

```
index.html, classic.html, quote.html, splash.html, bankai.html
css/theme.css      renk/tipografi jetonları (açık + koyu tema)
css/game.css       bileşenler
js/i18n.js         arayüz dili ve veri değerlerinin çevirisi (diğerlerinden önce yüklenir)
js/game-core.js    günlük seçim, autocomplete, sütun karşılaştırma
js/data.js         characters.json + overrides.json birleştirme
js/classic.js      Classic modu
js/simple-mode.js  Quote/Splash/Bankai için ortak iskelet
data/              karakter verisi ve görseller
scripts/           veri kazıma ve üretim betikleri (Python)
```

`scripts/` altındakiler tek seferlik araçlar: `scrape.py` karakter verisini,
`scrape_quotes.py` replikleri, `scrape_splash.py` ikinci görsel setini Bleach
Wiki'den çeker; `build_bankai.py` bankai havuzunu üretir; `make_og.py` paylaşım
görselini çizer. Oyunun çalışması için hiçbiri gerekmiyor.

Kazınan veriye elle yapılan düzeltmeler `data/overrides.json`'da tutuluyor —
kazıma yeniden çalıştırıldığında kaybolmasınlar diye. Saç rengi ve yaş kovası
tamamen oradan geliyor (wiki infobox'ında saç rengi alanı yok).

## Künye

Fan projesi, ticari değil. Karakter verisi ve görseller
[Bleach Wiki](https://bleach.fandom.com)'den alınmıştır.
Bleach © Tite Kubo / Shueisha.
