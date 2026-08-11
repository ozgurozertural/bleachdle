#!/usr/bin/env python3
"""Fontları alt kümeleyip fonts/ altına woff2 olarak yazar.

Neden kendi barındırıyoruz: fontlar Google'dan çekilirken her ziyaretçinin IP
adresi ve User-Agent'ı Google'a gidiyordu — KVKK/GDPR açısından rıza alınmamış
bir yurt dışı aktarımı. Yan fayda: theme.css içindeki @import zinciri kalkıyor
(font indirmesi artık CSS'i beklemiyor) ve CSP'de dış kaynak kalmıyor.

Tam Japonca fontlar 2,5 MB'ın üstünde; sitede yalnızca 11 kanji geçtiği için
alt küme alınıyor. Latin tarafı Türkçe + karakter adlarındaki makronlar
(Ōetsu, Jūshirō) ve aksanlar için Latin Extended-A'ya kadar tutuluyor.

    python3 scripts/build_fonts.py
"""

import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".fontcache"
OUT = ROOT / "fonts"

# Sitede gerçekten basılan CJK karakterleri (scripts/build_fonts.py --scan ile
# yeniden çıkarılabilir): mühür, mod ikonları, sonuç paneli, tema jetonları.
KANJI = "卍名夜影日昼月正死終言"

# Latin-1 + Latin Ext-A (makronlar, ş/ğ/ı), birleşen aksanlar, tipografik
# noktalama (“ ” · —), oklar (↑ ↓ ←), geometrik şekiller (○) ve ×/✓/✗.
UNICODES = (
    "U+0000-00FF,U+0100-017F,U+0300-036F,U+2000-206F,"
    "U+2190-21FF,U+25A0-25FF,U+2713,U+2717"
)

FACES = [
    ("dela", "ofl/delagothicone/DelaGothicOne-Regular.ttf"),
    ("zen-400", "ofl/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf"),
    ("zen-500", "ofl/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf"),
    ("zen-700", "ofl/zenkakugothicnew/ZenKakuGothicNew-Bold.ttf"),
]

LICENSES = [
    ("DelaGothicOne-OFL.txt", "ofl/delagothicone/OFL.txt"),
    ("ZenKakuGothicNew-OFL.txt", "ofl/zenkakugothicnew/OFL.txt"),
]

RAW = "https://github.com/google/fonts/raw/main/"


def fetch(rel, dest):
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print("indiriliyor:", rel)
    urllib.request.urlretrieve(RAW + rel, dest)
    return dest


def main():
    OUT.mkdir(exist_ok=True)
    total = 0
    for name, rel in FACES:
        src = fetch(rel, CACHE / (name + ".ttf"))
        dst = OUT / (name + ".woff2")
        subprocess.run([
            sys.executable, "-m", "fontTools.subset", str(src),
            "--output-file=" + str(dst),
            "--flavor=woff2",
            "--layout-features=kern,liga,ccmp,locl,mark,mkmk",
            "--unicodes=" + UNICODES,
            "--text=" + KANJI,
        ], check=True)
        kb = dst.stat().st_size // 1024
        total += kb
        print(f"  {dst.relative_to(ROOT)}  {kb} KB  ({src.stat().st_size // 1024} KB kaynaktan)")

    # OFL lisansı fontlarla birlikte dağıtılmak zorunda.
    for out_name, rel in LICENSES:
        fetch(rel, OUT / out_name)

    print(f"toplam: {total} KB")


if __name__ == "__main__":
    main()
