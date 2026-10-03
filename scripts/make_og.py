#!/usr/bin/env python3
"""Paylaşım görselini (og:image, 1200x630) üretir.

Sitenin karanlık temasının aynısı: Espada eseri, üstünde perde, hanko mührü,
Dela Gothic One başlık. Eser ya da tipografi değişirse yeniden çalıştır:

    python3 scripts/make_og.py

Fontlar Google Fonts deposundan indirilip scripts/.fontcache'e konur (git'e
girmez). Çıktı: og.jpg — kök dizinde, HTML'lerdeki og:image bunu gösteriyor.
"""

import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".fontcache"
OUT = ROOT / "og.jpg"
ART = ROOT / "data" / "images" / "bg-espada.webp"

W, H = 1200, 630

# theme.css'teki karanlık tema jetonları
INK = (244, 241, 230)      # --ink
INK_2 = (176, 174, 164)    # --ink-2
SEAL = (255, 59, 47)       # --seal
ON_SEAL = (12, 12, 15)     # --on-seal

FONTS = {
    "dela": "ofl/delagothicone/DelaGothicOne-Regular.ttf",
    "body-bold": "ofl/mplus1p/MPLUS1p-Bold.ttf",
    "body": "ofl/mplus1p/MPLUS1p-Regular.ttf",
}


def font(name, size):
    path = CACHE / (name + ".ttf")
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        url = "https://github.com/google/fonts/raw/main/" + FONTS[name]
        print("indiriliyor:", url)
        urllib.request.urlretrieve(url, path)
    return ImageFont.truetype(str(path), size)


def cover(img, w, h, focus_y=0.52):
    """Eseri kırpmadan sığdırmak yerine kadrajı doldurur (CSS'teki cover)."""
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    top = min(max(round(img.height * focus_y - h / 2), 0), img.height - h)
    left = (img.width - w) // 2
    return img.crop((left, top, left + w, top + h))


def main():
    base = cover(Image.open(ART).convert("RGB"), W, H)

    # Perde: sitede 0.18 yetiyor çünkü metin opak kağıt tabakanın üstünde.
    # Burada yazı doğrudan eserin üstünde, o yüzden çok daha koyu.
    base = Image.blend(base, Image.new("RGB", (W, H), (12, 12, 15)), 0.62)

    # Alttan yukarı koyulaşan perde: mod etiketleri sağ altta Grimmjow'un açık
    # renkli saçının üstüne düşüyor, düz perde orayı kurtarmıyor.
    grad = Image.linear_gradient("L").resize((W, H))
    grad = grad.point(lambda v: int(255 * max(0.0, (v / 255 - 0.42) / 0.58) ** 1.6 * 0.78))
    base = Image.composite(Image.new("RGB", (W, H), (9, 9, 12)), base, grad)

    d = ImageDraw.Draw(base)

    # Hanko: dolu kızıl kare, içinde 死. Sitedeki markanın aynısı.
    seal_px, seal_x, seal_y = 104, 96, 112
    d.rectangle([seal_x, seal_y, seal_x + seal_px, seal_y + seal_px], fill=SEAL)
    d.text((seal_x + seal_px / 2, seal_y + seal_px / 2 + 2), "死",
           font=font("dela", 60), fill=ON_SEAL, anchor="mm")

    # Başlık
    d.text((seal_x, seal_y + seal_px + 44), "BLEACHDLE", font=font("dela", 96), fill=INK)

    # Alt başlık
    d.text((seal_x + 4, seal_y + seal_px + 168),
           "Her gün yeni bir Bleach karakteri.", font=font("body-bold", 34), fill=INK)
    d.text((seal_x + 4, seal_y + seal_px + 214),
           "Kaç denemede bileceksin?", font=font("body", 34), fill=INK_2)

    # Dört mod — ana sayfadaki kartların kanjileri. Metnin tamamı tek bir sol
    # sütunda: sağ yarı eserin kendisine bırakıldı, orası açık renkli
    # üniformalarla dolu ve yazıyı taşımıyor.
    f_mode = font("dela", 26)
    f_label = font("body-bold", 14)
    x = seal_x + 4
    for kanji, label in [("名", "CLASSIC"), ("言", "QUOTE"), ("影", "SPLASH"), ("卍", "BANKAI")]:
        d.text((x, H - 132), kanji, font=f_mode, fill=INK)
        # Etiketler harf aralıklı: sitedeki .mode-card h2 gibi
        lx = x
        for ch in label:
            d.text((lx, H - 88), ch, font=f_label, fill=INK_2)
            lx += d.textbbox((0, 0), ch, font=f_label)[2] + 3
        x = lx + 34

    base.save(OUT, quality=88, optimize=True, progressive=True)
    print(f"yazıldı: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
