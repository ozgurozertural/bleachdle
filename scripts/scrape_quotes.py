#!/usr/bin/env python3
"""
Pulls the "Quotes" section out of each character's Bleach Wiki page and writes
cleaned English candidates to data/quotes_en.json:

  {"<character_id>": ["quote", "quote", ...]}

These are candidates for translation, not game data — data/quotes.json (Turkish)
is what the Quote mode actually reads.

Quotes that give the answer away are dropped: anything containing the speaker's
own name or one of their name parts.

Usage: python3 scripts/scrape_quotes.py
"""
import importlib.util, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / "data" / "characters.json"
OUT = ROOT / "data" / "quotes_en.json"
PER_CHAR = 4
MIN_LEN, MAX_LEN = 40, 260

spec = importlib.util.spec_from_file_location("scrape", ROOT / "scripts" / "scrape.py")
scrape = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scrape)


def clean(line):
    s = line
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{Qref[^}]*\}\}", "", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"^\s*\*+\s*", "", s)
    s = re.sub(r"^\s*\([^)]*\)\s*", "", s)          # "(To Ichigo) " speaker context
    s = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", s)  # [[Page|Label]] -> Label
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    s = s.strip().strip('"').strip("'").strip()
    s = re.sub(r"\s+", " ", s)
    return s


def extract(wikitext):
    m = re.search(r"==+\s*Quotes\s*==+(.*?)(?=\n==[^=]|\Z)", wikitext, re.S | re.I)
    if not m:
        return []
    body = m.group(1)
    # the wiki wraps long quote lists in {{Scroll-1|...}}; split on bullets either way
    parts = re.split(r"\n\s*\*|\|\s*\*", body)
    out = []
    for p in parts:
        q = clean(p)
        if MIN_LEN <= len(q) <= MAX_LEN and q not in out:
            out.append(q)
    return out


def main():
    chars = json.loads(CHARS.read_text(encoding="utf-8"))
    result = {}
    for i, c in enumerate(chars, 1):
        name = c["name"]
        wt = scrape.fetch_wikitext(name)
        if not wt:
            print(f"[{i}/{len(chars)}] {name}: no page", file=sys.stderr)
            continue
        quotes = extract(wt)

        # drop self-identifying quotes
        parts = [p for p in re.split(r"[\s\-]+", name) if len(p) > 2]
        safe = [q for q in quotes if not any(p.lower() in q.lower() for p in parts)]

        if safe:
            result[c["id"]] = safe[:PER_CHAR]
        print(f"[{i}/{len(chars)}] {name}: {len(safe)} usable (of {len(quotes)})")

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT.name}: {len(result)}/{len(chars)} characters")


if __name__ == "__main__":
    main()
