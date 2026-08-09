#!/usr/bin/env python3
"""
Re-downloads every character avatar from the Bleach Fandom Wiki and stores it as
a real .webp (the wiki already serves WebP; the old files were WebP bytes behind
a .png name). Images are capped at 512px on the long edge to keep the repo lean.

Usage: python3 scripts/refresh_images.py
"""
import importlib.util, io, json, os, re, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "data" / "images"
CHARS = ROOT / "data" / "characters.json"
MAX_EDGE = 512

spec = importlib.util.spec_from_file_location("scrape", ROOT / "scripts" / "scrape.py")
scrape = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scrape)


def slug(name):
    return re.sub(r"[^\w\-]", "_", name)


def main():
    chars = json.loads(CHARS.read_text(encoding="utf-8"))
    kept, failed = set(), []

    for i, c in enumerate(chars, 1):
        name = c["name"]
        dest = IMG_DIR / f"{slug(name)}.webp"
        rel = f"data/images/{dest.name}"
        if dest.exists():
            c["image"] = rel
            kept.add(dest.name)
            continue

        wt = scrape.fetch_wikitext(name)
        params = scrape.extract_infobox_params(wt) if wt else None
        fname = scrape.parse_first_image((params or {}).get("image", ""))
        url = scrape.fetch_image_url(fname) if fname else None
        if not url:
            print(f"[{i}/{len(chars)}] {name}: no image found", file=sys.stderr)
            failed.append(name)
            c["image"] = ""
            continue

        req = urllib.request.Request(url, headers={"User-Agent": scrape.UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()

        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        im.save(dest, "WEBP", quality=82, method=6)
        c["image"] = rel
        kept.add(dest.name)
        print(f"[{i}/{len(chars)}] {name} -> {dest.name} ({dest.stat().st_size // 1024} KB)")

    CHARS.write_text(json.dumps(chars, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Drop the stale .png files that are now superseded by .webp
    for old in IMG_DIR.glob("*.png"):
        old.unlink()

    print(f"\ndone: {len(kept)} images, {len(failed)} missing {failed}")


if __name__ == "__main__":
    main()
