#!/usr/bin/env python3
"""
Builds data/bankai.json from the zanpakutō / resurrección fields already scraped
into data/characters.json. Existing hand-curated entries win — this only fills gaps.

One entry per character, keyed by character id:
  {"name": <release name>, "type": "Bankai"|"Shikai"|"Resurrección", "ability": <extra hint>}

Preference: Bankai > Resurrección > Shikai, so the prompt names the strongest
release the character has. The `ability` line carries the lesser release as a hint.

Usage: python3 scripts/build_bankai.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / "data" / "characters.json"
OUT = ROOT / "data" / "bankai.json"


# Infoboxes use these instead of a real release name; they are not guessable prompts.
PLACEHOLDER = re.compile(
    r"^(none|n/?a|yok|unknown|unnamed|undisclosed|not\s+(yet\s+)?(achieved|revealed|named|known)"
    r"|unrevealed|unachieved|\?+|-+)$",
    re.IGNORECASE,
)


def val(c, field):
    v = (c.get(field) or "").strip()
    return "" if not v or PLACEHOLDER.match(v) else v


def main():
    chars = json.loads(CHARS.read_text(encoding="utf-8"))
    existing = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}

    out = {}
    added = []
    for c in chars:
        cid = c["id"]
        if cid in existing:
            out[cid] = existing[cid]
            continue

        shikai, bankai, resu = val(c, "shikai"), val(c, "bankai"), val(c, "resurreccion")
        if bankai:
            entry = {"name": bankai, "type": "Bankai"}
            if shikai:
                entry["ability"] = f"Shikai: {shikai}"
        elif resu:
            entry = {"name": resu, "type": "Resurrección"}
        elif shikai:
            entry = {"name": shikai, "type": "Shikai"}
        else:
            continue

        out[cid] = entry
        added.append(c["name"])

    # keep file ordered like characters.json, then any curated leftovers
    for cid, entry in existing.items():
        out.setdefault(cid, entry)

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"bankai.json: {len(existing)} -> {len(out)} entries (+{len(added)})")
    for n in added:
        print("  +", n)


if __name__ == "__main__":
    main()
