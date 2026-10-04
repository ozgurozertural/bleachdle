#!/usr/bin/env python3
"""
Bleachdle scraper — fetches character data from Bleach Fandom Wiki via MediaWiki API.
Outputs data/characters.json and downloads avatar images to data/images/.
"""
import io, json, os, re, time, sys, urllib.request, urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
IMG_DIR = DATA_DIR / "images"
IMG_DIR.mkdir(parents=True, exist_ok=True)

API = "https://bleach.fandom.com/api.php"
UA = "BleachdleBot/1.0 (educational fan project)"

# Curated character list — page titles on Bleach Fandom Wiki.
# Grouped for readability; the scraper flattens and dedupes.
CHARACTERS = [
    # Main characters & Karakura group
    "Ichigo Kurosaki", "Rukia Kuchiki", "Renji Abarai", "Orihime Inoue",
    "Uryū Ishida", "Yasutora Sado", "Kisuke Urahara", "Yoruichi Shihōin",
    "Isshin Kurosaki", "Kon",
    # Gotei 13 Captains
    "Shunsui Kyōraku", "Sōsuke Aizen", "Rōjūrō Ōtoribashi", "Retsu Unohana",
    "Sajin Komamura", "Shinji Hirako", "Byakuya Kuchiki", "Sui-Feng",
    "Kaname Tōsen", "Tōshirō Hitsugaya", "Kenpachi Zaraki", "Mayuri Kurotsuchi",
    "Jūshirō Ukitake", "Kensei Muguruma", "Genryūsai Shigekuni Yamamoto",
    # Gotei 13 Lieutenants
    "Nanao Ise", "Momo Hinamori", "Izuru Kira", "Isane Kotetsu",
    "Iba Tetsuzaemon", "Marechiyo Ōmaeda", "Hisagi Shūhei", "Rangiku Matsumoto",
    "Yachiru Kusajishi", "Nemu Kurotsuchi", "Chōjirō Sasakibe",
    "Gin Ichimaru",
    # Notable Shinigami
    "Ikkaku Madarame", "Yumichika Ayasegawa", "Hanatarō Yamada", "Ganju Shiba",
    "Kūkaku Shiba", "Kaien Shiba", "Jidanbō Ikkanzaka",
    # Vizards
    "Hachigen Ushōda", "Lisa Yadōmaru", "Love Aikawa", "Mashiro Kuna",
    # Espada
    "Coyote Starrk", "Baraggan Louisenbairn", "Tier Harribel", "Ulquiorra Cifer",
    "Nnoitra Gilga", "Grimmjow Jaegerjaquez", "Zommari Rureaux", "Szayelaporro Granz",
    "Aaroniero Arruruerie", "Yammy Llargo",
    # Notable Arrancar / Fracción
    "Nelliel Tu Odelschwanck", "Wonderweiss Margela", "Findorr Calius",
    "Dordoni Alessandro Del Socaccio", "Cirucci Sanderwicci",
    "Gantenbainne Mosqueda", "Luppi Antenor",
    # Xcution
    "Kūgo Ginjō", "Shūkurō Tsukishima", "Giriko Kutsuzawa", "Jackie Tristan",
    "Yukio Hans Vorarlberna", "Riruka Dokugamine",
    # Sternritter (Wandenreich)
    "Yhwach", "Jugram Haschwalth", "Uryū Ishida",  # (Uryū joins later, duplicate ok)
    "Bazz-B", "Cang Du", "Äs Nödt",
    "Bambietta Basterbine", "Candice Catnipp", "Giselle Gewelle",
    "Meninas McAllon", "Liltotto Lamperd", "PePe Waccabrada",
    "Robert Accutrone", "NaNaNa Najahkoop", "Berenice Gabrielli",
    "Driscoll Berci", "BG9", "Mask De Masculine", "Gremmy Thoumeaux",
    "Quilge Opie", "Gerard Valkyrie", "Askin Nakk Le Vaar",
    "Lille Barro", "Pernida Parnkgjas", "Nianzol Weizol",
    # Others
    "Ryūken Ishida", "Karin Kurosaki", "Yuzu Kurosaki",
    "Sōken Ishida", "Kūkaku Shiba",
    # Royal Guard (Zero Division)
    "Ichibē Hyōsube", "Ōetsu Nimaiya", "Kirio Hikifune",
    "Tenjirō Kirinji", "Senjumaru Shutara",
    # Urahara Shop
    "Tessai Tsukabishi", "Ururu Tsumugiya", "Jinta Hanakari",
    # Karakura Humans
    "Tatsuki Arisawa", "Keigo Asano", "Mizuiro Kojima",
    "Chizuru Honshō", "Don Kanonji", "Masaki Kurosaki",
    # Added 2026-10 after the wiki audit
    "Hiyori Sarugaki", "Lilynette Gingerbuck",
    "Emilou Apacci", "Franceska Mila Rose", "Cyan Sung-Sun",
    "Grand Fisher", "Ggio Vega", "Akon", "Kiyone Kotetsu", "Sentarō Kotsubaki",
    "Moe Shishigawara", "Royd Lloyd",
]

# Display names that differ from the page title. The title stays in CHARACTERS
# because the id is derived from it; these two were listed family name first.
DISPLAY_NAMES = {
    "Iba Tetsuzaemon": "Tetsuzaemon Iba",
    "Hisagi Shūhei": "Shūhei Hisagi",
}

def api_get(params, retries=3):
    params = {**params, "format": "json"}
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == retries - 1:
                print(f"  ! api_get failed: {e}", file=sys.stderr)
                return None
            time.sleep(1.5 * (attempt + 1))

def fetch_wikitext(title):
    r = api_get({"action": "parse", "page": title, "prop": "wikitext", "redirects": "1"})
    if not r or "parse" not in r:
        return None
    return r["parse"]["wikitext"]["*"]

def fetch_image_url(filename):
    """Given File:Foo.png, return direct image URL."""
    if not filename.lower().startswith("file:"):
        filename = "File:" + filename
    r = api_get({"action": "query", "titles": filename, "prop": "imageinfo", "iiprop": "url"})
    if not r: return None
    pages = r.get("query", {}).get("pages", {})
    for p in pages.values():
        ii = p.get("imageinfo")
        if ii: return ii[0].get("url")
    return None

MAX_IMG_EDGE = 512

def save_image(title, img_file):
    """Download the wiki image and store it as data/images/<Title>.webp. Returns the
    relative path, or None. Existing files are reused — delete one to force a refetch."""
    if not img_file:
        return None
    dest = IMG_DIR / (re.sub(r"[^\w\-]", "_", title) + ".webp")
    rel = f"data/images/{dest.name}"
    if dest.exists():
        return rel

    url = fetch_image_url(img_file)
    if not url:
        print(f"  ! no image url for {img_file}")
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        im.thumbnail((MAX_IMG_EDGE, MAX_IMG_EDGE), Image.LANCZOS)
        im.save(dest, "WEBP", quality=82, method=6)
    except Exception as e:
        print(f"  ! img download failed: {e}")
        return None
    return rel

# ---------- wikitext parsing ----------

# strip HTML tags, refs, links
def clean_wikitext(v):
    if not v: return ""
    v = re.sub(r"<ref[^>]*?/>", "", v)
    v = re.sub(r"<ref[^>]*?>.*?</ref>", "", v, flags=re.DOTALL)
    v = re.sub(r"<br\s*/?>", " / ", v, flags=re.IGNORECASE)
    v = re.sub(r"<[^>]+>", "", v)
    # [[link|text]] -> text; [[link]] -> link
    v = re.sub(r"\[\[([^\]\|]+)\|([^\]]+)\]\]", r"\2", v)
    v = re.sub(r"\[\[([^\]]+)\]\]", r"\1", v)
    # {{template|...}} -> drop
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)
    v = re.sub(r"''+", "", v)
    v = re.sub(r"\s+", " ", v).strip()
    return v.strip(" ,;/")

def extract_infobox_params(wt):
    """Extract template params from the 'Bleach Wiki:Character Template' block."""
    # find template start
    m = re.search(r"\{\{Bleach Wiki:Character Template[^\n]*", wt)
    if not m: return {}
    start = m.end()
    # walk balanced braces to find end
    depth = 2
    i = start
    while i < len(wt) and depth > 0:
        if wt[i] == "{" and wt[i+1:i+2] == "{":
            depth += 1; i += 2
        elif wt[i] == "}" and wt[i+1:i+2] == "}":
            depth -= 1; i += 2
        else:
            i += 1
    body = wt[start:i-2]
    # split params on | that are at depth 0
    params, buf, d = [], "", 0
    for ch in body:
        if ch == "{": d += 1
        elif ch == "}": d -= 1
        elif ch == "[": d += 1
        elif ch == "]": d -= 1
        if ch == "|" and d == 0:
            params.append(buf); buf = ""
        else:
            buf += ch
    params.append(buf)
    out = {}
    for p in params:
        if "=" in p:
            k, v = p.split("=", 1)
            out[k.strip().lower()] = v.strip()
    return out

def parse_first_image(image_field):
    """image field can be a <gallery> or single filename."""
    if not image_field: return None
    # \w is unicode-aware: filenames contain macrons (ō, ū) and accents (ì, ē).
    m = re.search(r"([\w\-\. '()]+\.(?:png|jpg|jpeg|webp))", image_field, re.IGNORECASE)
    return m.group(1) if m else None

def norm_race(v, profession=""):
    full = clean_wikitext(v).lower()
    v = full.split("(")[0].strip()
    # "Leader of the Arrancar Army" is a post, not a race: it made Aizen and Tōsen "Arrancar"
    p = clean_wikitext(profession).lower().replace("arrancar army", "")
    # Special-case: Fullbringer overrides Human when it's the profession identity
    if "fullbringer" in p or ("fullbringer" in full and "hybrid" not in full):
        return "Fullbringer"
    combined = v + " " + p
    for k, tag in [
        ("arrancar", "Arrancar"),
        ("visored", "Visored"),
        ("vizard", "Visored"),
        ("fullbringer", "Fullbringer"),
        ("quincy", "Quincy"),
        ("hollow", "Hollow"),
        ("bount", "Bount"),
        ("shinigami", "Shinigami"),
        ("soul reaper", "Shinigami"),
    ]:
        if k in combined: return tag
    # "Soul" alone (Fandom's shorthand for Shinigami on Gotei 13 members)
    if v.strip() == "soul" or "soul" in v:
        if "shinigami" in p or "captain" in p or "lieutenant" in p or v.strip() == "soul":
            return "Shinigami"
    if "human" in v: return "Human"
    return "Unknown"

def norm_gender(v):
    v = clean_wikitext(v).lower()
    if "female" in v: return "Female"
    if "male" in v: return "Male"
    return "Unknown"

def norm_affiliation(v):
    v = clean_wikitext(v)
    lo = v.lower()
    for k, tag in [
        ("gotei 13", "Gotei 13"),
        ("soul society", "Gotei 13"),
        ("espada", "Espada"),
        ("hueco mundo", "Espada"),
        ("wandenreich", "Wandenreich"),
        ("sternritter", "Wandenreich"),
        ("vandenreich", "Wandenreich"),
        ("xcution", "Xcution"),
        ("visored", "Visored"),
        ("vizard", "Visored"),
        ("karakura", "Ryoka"),
        ("kurosaki", "Ryoka"),
    ]:
        if k in lo: return tag
    return "Other"

def extract_division(*fields):
    txt = clean_wikitext(" ".join(f or "" for f in fields)).lower()
    m = re.search(r"(\d+)(?:st|nd|rd|th)?\s*division", txt)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 13: return n
    m = re.search(r"division\s*(\d+)", txt)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 13: return n
    return None

def norm_rank(*fields):
    txt = clean_wikitext(" ".join(f or "" for f in fields)).lower()
    if "captain-commander" in txt or "captain commander" in txt: return "Captain-Commander"
    if "captain" in txt and "vice-captain" not in txt and "vice captain" not in txt: return "Captain"
    if "lieutenant" in txt or "vice-captain" in txt or "vice captain" in txt: return "Lieutenant"
    if "3rd seat" in txt or "third seat" in txt: return "3rd Seat"
    if "5th seat" in txt: return "5th Seat"
    if "seated" in txt or " seat " in txt: return "Seated Officer"
    if "espada" in txt: return "Espada"
    if "sternritter" in txt: return "Sternritter"
    if "substitute shinigami" in txt: return "Substitute Shinigami"
    if "arrancar" in txt: return "Arrancar"
    if "fullbringer" in txt: return "Fullbringer"
    if "shinigami" in txt: return "Shinigami"
    if "quincy" in txt: return "Quincy"
    return "Other"

HAIR_MAP = [
    ("black", "Black"), ("blonde", "Blonde"), ("blond", "Blonde"),
    ("orange", "Orange"), ("red", "Red"), ("brown", "Brown"),
    ("white", "White"), ("silver", "White"), ("grey", "Grey"), ("gray", "Grey"),
    ("purple", "Purple"), ("violet", "Purple"),
    ("pink", "Pink"),
    ("blue", "Blue"), ("teal", "Blue"), ("cyan", "Blue"),
    ("green", "Green"),
]
def norm_hair(v):
    for k, tag in HAIR_MAP:
        if k in v: return tag
    return "Other"

def norm_eye(v):
    for k, tag in HAIR_MAP:
        if k in v: return tag
    return "Other"

LOC_MAP = [
    ("hueco mundo", "Hueco Mundo"),
    ("las noches", "Hueco Mundo"),
    ("wandenreich", "Wandenreich"),
    ("silbern", "Wandenreich"),
    ("soul society", "Soul Society"),
    ("seireitei", "Soul Society"),
    ("rukongai", "Soul Society"),
    ("karakura", "Karakura Town"),
    ("naruki", "Naruki City"),
    ("world of the living", "Human World"),
]
def norm_location(v):
    if not v: return "Unknown"
    lo = v.lower()
    for k, tag in LOC_MAP:
        if k in lo: return tag
    return "Other"

# Chapter → Arc mapping (approximate, based on public arc summaries)
ARCS = [
    (1, 70,   "Substitute"),
    (71, 181, "Soul Society"),
    (182, 315,"Arrancar"),
    (316, 423,"Fake Karakura"),
    (424, 479,"Fullbring"),
    (480, 686,"TYBW"),
]
def chapter_to_arc(ch):
    for a,b,name in ARCS:
        if a <= ch <= b: return name
    return None

def extract_ability_name(v):
    """Extract '''Foo''' style bold names or plain text."""
    if not v: return None
    m = re.search(r"'''([^']+)'''", v)
    if m: return clean_wikitext(m.group(1))
    return clean_wikitext(v).split(",")[0].split("(")[0].strip() or None

def parse_age(v):
    """First number in the age field. "N+" means more than N, so it becomes N+1:
    otherwise "1,000+" lands on the 101-1000 bucket boundary instead of 1000+."""
    # drop thousands separators first, else "2,000+" would parse as 2
    txt = clean_wikitext(v).replace(",", "")
    m = re.search(r"(\d{1,5})(\+?)", txt)
    if not m: return None
    return int(m.group(1)) + (1 if m.group(2) else 0)

# main
def scrape(merge=False):
    """merge=True keeps characters already in characters.json and only scrapes titles
    that are missing, so re-runs stay cheap and don't churn existing records."""
    out = DATA_DIR / "characters.json"
    existing = []
    if merge and out.exists():
        existing = json.loads(out.read_text(encoding="utf-8"))
    have = {c["id"] for c in existing}

    titles = [t for t in dict.fromkeys(CHARACTERS)
              if not merge or re.sub(r"[^\w]", "_", t).strip("_") not in have]
    if merge:
        print(f"{len(existing)} existing, {len(titles)} to scrape")

    seen = set()
    results = []
    for i, title in enumerate(titles):
        if title in seen: continue
        seen.add(title)
        print(f"[{i+1}/{len(CHARACTERS)}] {title}")
        wt = fetch_wikitext(title)
        if not wt:
            print("  ! no wikitext"); continue
        params = extract_infobox_params(wt)
        if not params:
            print("  ! no infobox"); continue

        img_local = save_image(title, parse_first_image(params.get("image", "")))

        occupation = " ".join([
            params.get("occupation", ""),
            params.get("previous occupation", ""),
            params.get("position", ""),
            params.get("previous position", ""),
            params.get("profession", ""),
            params.get("previous profession", ""),
        ])
        affiliation = params.get("affiliation", "") + " " + params.get("previous affiliation", "")
        division_field = params.get("division", "") + " " + params.get("previous division", "")

        shikai = extract_ability_name(params.get("shikai", ""))
        bankai = extract_ability_name(params.get("bankai", ""))
        resurreccion = extract_ability_name(params.get("resurrección", "") or params.get("resurreccion", ""))

        # Age: first number ("N+" → N+1, see parse_age)
        age = parse_age(params.get("age", ""))

        # Height: first cm number
        h_txt = clean_wikitext(params.get("height", ""))
        m = re.search(r"(\d{2,3})\s*cm", h_txt)
        height_cm = int(m.group(1)) if m else None

        # Hair color: normalize
        hair_raw = clean_wikitext(params.get("hair color", "")).lower()
        hair = norm_hair(hair_raw)

        eye_raw = clean_wikitext(params.get("eye color", "")).lower()
        eyes = norm_eye(eye_raw)

        # Location: base of operations or affiliation-derived
        loc_raw = clean_wikitext(params.get("base of operations", ""))
        location = norm_location(loc_raw or affiliation)

        # First arc from manga debut chapter
        debut = params.get("manga debut", "")
        m = re.search(r"Chapter\s*(\d+)", debut)
        first_arc = chapter_to_arc(int(m.group(1))) if m else None

        rec = {
            "id": re.sub(r"[^\w]", "_", title).strip("_"),
            "name": DISPLAY_NAMES.get(title, title),
            "gender": norm_gender(params.get("gender", "")),
            "race": norm_race(params.get("race", ""), occupation),
            "affiliation": norm_affiliation(affiliation + " " + occupation),
            "rank": norm_rank(occupation),
            "division": extract_division(division_field, occupation, affiliation),
            "has_bankai": bool(bankai),
            "shikai": shikai,
            "bankai": bankai,
            "resurreccion": resurreccion,
            "age": age,
            "height_cm": height_cm,
            "hair": hair,
            "eyes": eyes,
            "location": location,
            "first_arc": first_arc,
            "birthday": clean_wikitext(params.get("birthday", "")),
            "image": img_local,
        }
        results.append(rec)
        time.sleep(0.3)  # be nice

    all_chars = existing + results
    out.write_text(json.dumps(all_chars, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {len(all_chars)} characters to {out} (+{len(results)} new)")

if __name__ == "__main__":
    scrape(merge="--merge" in sys.argv)
