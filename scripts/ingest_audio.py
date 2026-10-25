#!/usr/bin/env python3
"""audio_in/ altındaki ham klipleri normalize edip data/audio/ altına yazar.

Ozgur klipleri elle buluyor ve kaba kesiyor (bkz. bleachdle-ses.xlsx). Bu betik
onları oyunun kullanacağı hale getirir:

  - Japonca ses izi, tek kanal (mono): konum bilgisi taşımıyor, boyutu yarıya
    indiriyor.
  - EBU R128 ile ölçülüp -16 LUFS'e getirilir, tepeler -3 dB'de sınırlanır:
    yoksa bir klip fısıltı, öbürü çığlık.
  - Baştan/sondan 10 ms fade: kesik dalga formu tık sesi veriyor.
  - AAC 64k / .m4a: Opus daha iyi sıkıştırır ama Safari'de riskli. 59 klip
    toplamı ~2,4 MB, sıkıştırmayı kovalamaya değmez.

Çalışma dosyasındaki başlangıç/süre doluysa ince kırpma da buradan yapılır,
böylece ham klip bozulmadan durur ve kırpma kararı geri alınabilir.

    python3 scripts/ingest_audio.py            # bankai + quote
    python3 scripts/ingest_audio.py bankai     # yalnız biri

FFMPEG / FFPROBE ortam değişkenleriyle başka bir ikili gösterilebilir.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "bleachdle-ses.xlsx"
LUFS = -16.0
TP_MAX = -1.0   # dBTP, kodlanmış çıktının gerçek tepesi

FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
FFPROBE = os.environ.get("FFPROBE") or shutil.which("ffprobe")

MODES = {
    "bankai": dict(sheet="Bankai", ids=lambda: set(json.loads((ROOT / "data/bankai.json").read_text()))),
    "quote":  dict(sheet="Quote",  ids=lambda: set(json.loads((ROOT / "data/quote_sources.json").read_text()))),
}


def read_sheet(name):
    """Çalışma dosyasındaki satırları {id: {sütun: değer}} olarak döner."""
    if not SHEET.exists():
        return {}
    from openpyxl import load_workbook
    ws = load_workbook(SHEET, data_only=True)[name]
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    out = {}
    for r in rows[1:]:
        rec = dict(zip(hdr, r))
        if rec.get("id"):
            out[rec["id"]] = rec
    return out


def duration(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()), 2)
    except ValueError:
        return None


def measure(src, cut=()):
    """(tümleşik ses düzeyi LUFS, gerçek tepe dBTP), mono indirgenmiş haliyle."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", *cut, "-i", str(src),
                        "-vn", "-map", "0:a:0", "-ac", "1",
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    i = re.findall(r"^\s+I:\s+(-?[\d.]+) LUFS", r.stderr, re.M)
    p = re.findall(r"^\s+Peak:\s+(-?[\d.]+|-inf) dBFS", r.stderr, re.M)
    return (float(i[-1]) if i else None, float(p[-1]) if p else None)


def convert(src, dst, start, dur):
    """Tek kanal, -16 LUFS, kenarları yumuşatılmış AAC.

    loudnorm burada kullanılmıyor: 3 sn'den kısa kliplerde ölçemiyor, dinamik
    moda düşüp hedefi kaçırıyordu (Renji -13,8 LUFS, tepe +0,9 dBTP çıktı).
    Onun yerine önce ölçüp sabit kazanç veriyoruz; kazancın taşırdığı tepeleri
    sınırlayıcı kırpıyor. Sınırlayıcı yalnız örneklere bakar; örnekler arası
    tepeleri yakalasın diye 4x örneklemede çalışıyor. AAC kodlarken tepeyi
    yine taşırabiliyor (yoğun kliplerde +1 dB), o yüzden çıktı ölçülüyor ve
    TP_MAX'ı aşarsa sınırlayıcı aşan kadar indirilip yeniden kodlanıyor."""
    cut = []
    if start:
        cut += ["-ss", str(start)]
    if dur:
        cut += ["-t", str(dur)]
    lufs, _ = measure(src, cut)
    gain = 0.0 if lufs is None or lufs < -70 else LUFS - lufs
    limit = -3.0
    for _ in range(4):
        filters = (f"volume={gain:.2f}dB,"
                   f"aresample=176400,alimiter=limit={10 ** (limit / 20):.4f}"
                   ":attack=1:release=50:level=disabled,aresample=44100,"
                   "afade=t=in:st=0:d=0.01,areverse,afade=t=in:st=0:d=0.01,areverse")
        cmd = [FFMPEG, "-y", "-loglevel", "error", *cut, "-i", str(src),
               "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "44100",
               "-af", filters, "-c:a", "aac", "-b:a", "64k", str(dst)]
        subprocess.run(cmd, check=True)
        _, tp = measure(dst)
        if tp is None or tp <= TP_MAX:
            break
        limit -= tp - TP_MAX + 0.3


def run(mode):
    cfg = MODES[mode]
    known = cfg["ids"]()
    sheet = read_sheet(cfg["sheet"])
    src_dir = ROOT / "audio_in" / mode
    out_dir = ROOT / "data/audio" / mode
    out_dir.mkdir(parents=True, exist_ok=True)

    files = {}
    for p in sorted(src_dir.glob("*")) if src_dir.exists() else []:
        if p.is_file() and not p.name.startswith("."):
            files.setdefault(p.stem, p)

    unknown = sorted(set(files) - known)
    manifest = {}
    for cid, src in sorted(files.items()):
        if cid not in known:
            continue
        rec = sheet.get(cid, {})
        dst = out_dir / f"{cid}.m4a"
        convert(src, dst, rec.get("başlangıç"), rec.get("süre_sn"))
        manifest[cid] = {
            "file": f"data/audio/{mode}/{cid}.m4a",
            "dur": duration(dst),
            "source": rec.get("kaynak") or None,
        }
        print(f"  {cid:34} {manifest[cid]['dur']}s  {dst.stat().st_size // 1024} KB")

    (ROOT / f"data/{mode}_audio.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True) + "\n")

    missing = sorted(known - set(manifest))
    absent = {c for c, r in sheet.items() if str(r.get("durum") or "").strip() == "animede yok"}
    print(f"\n{mode}: {len(manifest)}/{len(known)} klip hazır")
    if unknown:
        print(f"  ! tanınmayan dosya adı ({len(unknown)}): {', '.join(unknown[:6])}"
              f"{' …' if len(unknown) > 6 else ''}")
    if missing:
        print(f"  eksik ({len(missing)}): {', '.join(missing[:6])}{' …' if len(missing) > 6 else ''}")
        if absent:
            print(f"  bunların {len(absent)}'i çalışma dosyasında 'animede yok' işaretli")
        print("  UYARI: ipucunun VARLIĞI cevabı daraltır. Ya hepsi tamamlanmalı,")
        print("  ya da mod havuzu sesi olanlarla sınırlanmalı.")


def main():
    if not FFMPEG or not FFPROBE:
        sys.exit("ffmpeg/ffprobe bulunamadı. Kurulum: sudo apt install ffmpeg")
    for mode in (sys.argv[1:] or list(MODES)):
        if mode not in MODES:
            sys.exit(f"bilinmeyen mod: {mode}")
        run(mode)


if __name__ == "__main__":
    main()
