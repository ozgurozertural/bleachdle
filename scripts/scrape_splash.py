#!/usr/bin/env python3
"""
Splash modu için her karaktere ikinci bir görsel bulur.

Sorun: Splash, karakterin tahmin tablosunda kullanılan profil görselinin aynısını
gösteriyordu; aynı görsel otomatik tamamlama listesinde de küçük hâlde durduğu
için oyun tahmin olmaktan çıkıp eşleştirme oyununa dönüyordu.

Seçim kuralları:
  - dosya adı karakterin ayırt edici adını içerir,
  - başka bir karakterin adını içermez (kalabalık sahne elenir),
  - .gif ve sembol/amblem türü dosyalar elenir,
  - indirilen görsel, mevcut profil görselinden algısal olarak farklı olmalı
    (average hash mesafesi >= MIN_DIST), yoksa sıradaki aday denenir.

Çıktı: data/images/splash/<Başlık>.webp ve data/splash.json

Kullanım: python3 scripts/scrape_splash.py
"""
import importlib.util, io, json, re, sys, time, unicodedata, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("scrape", ROOT / "scripts" / "scrape.py")
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)

OUT_DIR = ROOT / "data" / "images" / "splash"
OUT_JSON = ROOT / "data" / "splash.json"
MAX_EDGE = 512
MIN_SIDE = 180
MIN_DIST = 12          # 64 bitlik average hash üzerinden en az bu kadar fark
BAD = re.compile(r"symbol|insignia|kanji|logo|cover|volume|emblem|badge|crest|"
                 r"seal|title|banner|card|sprite|icon", re.I)
# "AVsB", "AAndB" gibi çok kişilik sahneler splash için uygun değil
MULTI = re.compile(r"(?<=[a-z])(Vs|And|Meets?|Attacks?|Confronts?|Saves?|Protects?)(?=[A-Z])")


def ahash(im):
    g = im.convert("L").resize((8, 8), Image.LANCZOS)
    px = list(g.getdata()); avg = sum(px) / 64
    return sum(1 << i for i, p in enumerate(px) if p >= avg)


def dist(a, b):
    return bin(a ^ b).count("1")


def fold(s):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def tokens(name):
    """Ayırt edici ad parçaları. Macron'lu adlar dosya adlarında sade yazıldığı
    için karşılaştırma diakritiksiz yapılır; Gin/Kon gibi 3 harflileri de alır."""
    return [fold(t) for t in re.split(r"[\s\-]+", name) if len(t) >= 3]


def words(fname):
    """Dosya adını sözcüklere böler. Alt dize eşleşmesi yanlış eliyordu:
    'Sui' adı 'Shunsui'yi, 'Don' adı 'Dordoni'yi başka karakter sanıyordu."""
    base = fname[len("File:"):] if fname.startswith("File:") else fname
    base = re.sub(r"\.(png|jpe?g)$", "", base, flags=re.I)
    base = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", base)
    return {fold(w) for w in re.split(r"[^A-Za-zÀ-ÿĀ-ſ]+", base) if w}


def list_images(title):
    # redirects=1 olmadan "Sōsuke Aizen" gibi yönlendirilen başlıklar boş dönüyor
    r = sc.api_get({"action": "query", "prop": "images", "titles": title,
                    "imlimit": "500", "redirects": "1", "format": "json"})
    for p in r.get("query", {}).get("pages", {}).values():
        return [i["title"] for i in p.get("images", [])]
    return []


def fetch_image(fname):
    url = sc.fetch_image_url(fname[len("File:"):] if fname.startswith("File:") else fname)
    if not url:
        return None
    req = urllib.request.Request(url, headers={"User-Agent": sc.UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def rank(fname):
    """Tek kişilik portreler (…Profile…) en iyi splash adayı; ardından anime
    kareleri, çünkü renkli ve temiz."""
    base = fname[len("File:"):]
    return (0 if re.search(r"profile", base, re.I) else 1,
            0 if re.match(r"Ep\d+", base, re.I) else 1,
            len(base))


def main():
    chars = json.loads((ROOT / "data" / "characters.json").read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = json.loads(OUT_JSON.read_text(encoding="utf-8")) if OUT_JSON.exists() else {}

    all_tokens = {c["id"]: set(t.lower() for t in tokens(c["name"])) for c in chars}
    every = set().union(*all_tokens.values())

    for i, c in enumerate(chars, 1):
        cid, name = c["id"], c["name"]
        dest = OUT_DIR / (re.sub(r"[^\w\-]", "_", name) + ".webp")
        if cid in out and dest.exists():
            print(f"[{i}/{len(chars)}] {name}: var, atlandı"); continue

        prof_path = ROOT / (c.get("image") or "")
        prof_hash = ahash(Image.open(prof_path)) if c.get("image") and prof_path.exists() else None

        mine = all_tokens[cid]
        others = every - mine
        cands = []
        for f in list_images(name):
            base = f[len("File:"):] if f.startswith("File:") else f
            if not re.search(r"\.(png|jpe?g)$", base, re.I): continue
            if BAD.search(base) or MULTI.search(base): continue
            w = words(base)
            if not (w & mine): continue
            if w & others: continue
            cands.append(f)
        cands.sort(key=rank)

        chosen = None
        for f in cands[:6]:
            try:
                im = fetch_image(f)
            except Exception as e:
                print(f"    ! {f}: {e}"); continue
            if not im or min(im.size) < MIN_SIDE: continue
            if prof_hash is not None and dist(ahash(im), prof_hash) < MIN_DIST:
                print(f"    ~ {f}: profile çok benziyor, atlandı"); continue
            chosen = (f, im); break

        if not chosen:
            print(f"[{i}/{len(chars)}] {name}: uygun görsel yok ({len(cands)} aday)")
            continue

        f, im = chosen
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        im.save(dest, "WEBP", quality=82, method=6)
        out[cid] = f"data/images/splash/{dest.name}"
        print(f"[{i}/{len(chars)}] {name}: {f}")
        OUT_JSON.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        time.sleep(0.2)

    print(f"\nsplash görseli olan karakter: {len(out)}/{len(chars)}")


if __name__ == "__main__":
    main()
