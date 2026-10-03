#!/usr/bin/env python3
"""Ses toplama çalışma dosyasını (bleachdle-ses.xlsx) üretir.

Ozgur klipleri elle bulup audio_in/ altına bırakacak; bu dosya hangi kaydın
arandığını, hangisinin bulunduğunu ve klibin nereden alındığını izler.
Veriden üretiliyor ki bankai.json / quote_sources.json büyüdüğünde yeniden
çalıştırıp güncel listeyi almak mümkün olsun.

    python3 scripts/make_audio_sheet.py

Mevcut dosyanın üstüne yazmaz: önce eski dosyadaki doldurulmuş satırları okur,
id eşleşmesiyle geri taşır. Yani liste büyüse de girilen bilgi kaybolmaz.
"""

import json
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bleachdle-ses.xlsx"

# Ozgur'un dolduracağı sütunlar — yeniden üretimde bunlar korunur.
FILL = ["durum", "kaynak", "başlangıç", "süre_sn", "notlar"]

HDR_FILL = PatternFill("solid", fgColor="1F1F26")
HDR_FONT = Font(color="F4F1E6", bold=True)
LOCK_FILL = PatternFill("solid", fgColor="EFECE3")
DONE_FILL = PatternFill("solid", fgColor="DDF0E2")


def old_values(path):
    """Eski dosyadaki doldurulmuş hücreleri {sayfa: {id: {sütun: değer}}} olarak döner."""
    if not path.exists():
        return {}
    wb = load_workbook(path)
    out = {}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows or not rows[0] or "id" not in rows[0]:
            continue
        hdr = list(rows[0])
        idx = hdr.index("id")
        keep = {c: hdr.index(c) for c in FILL if c in hdr}
        out[ws.title] = {
            r[idx]: {c: r[i] for c, i in keep.items() if r[i] not in (None, "")}
            for r in rows[1:] if r[idx]
        }
    return out


def sheet(wb, title, headers, rows, prev, note):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(1, c)
        cell.fill, cell.font = HDR_FILL, HDR_FONT
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = "B2"

    saved = prev.get(title, {})
    for row in rows:
        rid = row[0]
        for col in FILL:
            row[headers.index(col)] = saved.get(rid, {}).get(col, "")
        ws.append(row)

    # durum için açılır liste
    dv = DataValidation(type="list", formula1='"aranıyor,bulundu,animede yok,belirsiz"',
                        allow_blank=True, showDropDown=False)
    ws.add_data_validation(dv)
    col = get_column_letter(headers.index("durum") + 1)
    dv.add(f"{col}2:{col}{len(rows) + 1}")

    # genişlikler ve referans sütunlarının gölgesi
    widths = {"id": 26, "karakter": 22, "dosya_adı": 26, "notlar": 40,
              "replik_tr": 60, "replik_en": 60, "yakalanacak": 34, "salım_adı": 24}
    first_fill = headers.index(FILL[0])
    for i, h in enumerate(headers, start=1):
        ws.column_dimensions[get_column_letter(i)].width = widths.get(h, 14)
        if i - 1 < first_fill:
            for r in range(2, len(rows) + 2):
                ws.cell(r, i).fill = LOCK_FILL

    ws.cell(len(rows) + 3, 1, note).font = Font(italic=True, color="65635B")
    return ws


def main():
    prev = old_values(OUT)
    wb = Workbook()
    wb.remove(wb.active)

    chars = {c["id"]: c for c in json.loads((ROOT / "data/characters.json").read_text())}

    # ---- Bankai ----
    bankai = json.loads((ROOT / "data/bankai.json").read_text())
    hdr_b = ["id", "karakter", "salım_adı", "tür", "yakalanacak", "dosya_adı"] + FILL
    rows_b = []
    for cid, v in sorted(bankai.items(), key=lambda kv: (kv[1]["type"], kv[0])):
        rows_b.append([
            cid, chars[cid]["name"], v["name"], v["type"],
            f'"{v["type"]}: {v["name"]}" çağrısı',
            cid, "", "", "", "", "",
        ])
    sheet(wb, "Bankai", hdr_b, rows_b, prev,
          "Dosyayı audio_in/bankai/ altına, dosya_adı sütunundaki adla bırak. Uzantı farketmez.")

    # ---- Quote (sonraki iş) ----
    qs = json.loads((ROOT / "data/quote_sources.json").read_text())
    qt = json.loads((ROOT / "data/quotes.json").read_text())
    hdr_q = ["id", "karakter", "replik_tr", "replik_en", "bölüm", "kaynak_türü",
             "dosya_adı"] + FILL
    rows_q = []
    for cid, v in sorted(qs.items()):
        rows_q.append([
            cid, chars[cid]["name"], qt.get(cid, ""), v.get("en", ""),
            v.get("chapter", ""), v.get("kind", ""), cid, "", "", "", "", "",
        ])
    sheet(wb, "Quote", hdr_q, rows_q, prev,
          "Sonraki iş. Bölüm numarası MANGA chapter'ı — anime bölümü ayrıca bulunmalı.")

    # ---- Nasıl ----
    ws = wb.create_sheet("Nasıl", 0)
    for line in [
        ("BLEACHDLE — SES TOPLAMA", True),
        ("", False),
        ("Dosyayı nereye koyacağım?", True),
        ("  audio_in/bankai/<dosya_adı>.<uzantı>   (Quote için audio_in/quote/)", False),
        ("  Uzantı farketmez: wav, mp3, m4a, flac, opus — hepsi olur.", False),
        ("  Ad, sayfadaki dosya_adı sütunuyla birebir aynı olmalı; eşleşme ondan yapılıyor.", False),
        ("", False),
        ("Klip nasıl olmalı?", True),
        ("  Sadece çağrının kendisi: 2-4 saniye. Uzunsa sorun değil, kırpılır.", False),
        ("  Ses seviyesini dert etme — hepsi EBU R128'e normalize edilecek.", False),
        ("  Japonca ses. Altyazılı/dublajlı sürümden değil.", False),
        ("  Kaba kes, baştan/sondan biraz fazlası kalsın; ince kırpmayı birlikte yaparız.", False),
        ("", False),
        ("Sayfadaki sütunlar", True),
        ("  durum      : aranıyor / bulundu / animede yok / belirsiz  (açılır liste)", False),
        ("  kaynak     : hangi bölüm, ör. 'TYBW 13' ya da 'Ep 142'", False),
        ("  başlangıç  : bölümdeki zaman, ör. 00:08:12", False),
        ("  süre_sn    : klibin saniyesi", False),
        ("  notlar     : aklında kalan her şey", False),
        ("  (Gri sütunlar veriden üretiliyor, elle değiştirme — yeniden üretimde geri gelir.)", False),
        ("", False),
        ("ÖNEMLİ — eksik ses cevabı ele verir", True),
        ("  İpucunun VARLIĞI tek başına bilgi: 55 kaydın 30'unda ses olursa, ses düğmesinin", False),
        ("  çıkıp çıkmaması cevabı daraltır. Quote havuzunun 45'te tutulmasının sebebi de buydu.", False),
        ("  İki çıkış var: ya 55'in hepsi tamamlanır, ya da havuz sesi olanlarla sınırlanır.", False),
        ("  Bu yüzden 'animede yok' durumu da en az 'bulundu' kadar değerli — işaretle.", False),
        ("", False),
        ("Dosyayı güncellemek", True),
        ("  python3 scripts/make_audio_sheet.py", False),
        ("  Doldurduğun satırlar id eşleşmesiyle korunur; veri büyüse de bilgi kaybolmaz.", False),
    ]:
        c = ws.cell(ws.max_row + 1 if ws.max_row > 1 or ws.cell(1, 1).value else 1, 1, line[0])
        if line[1]:
            c.font = Font(bold=True, size=12 if line[0].startswith("BLEACHDLE") else 11)
    ws.column_dimensions["A"].width = 100
    ws.sheet_view.showGridLines = False

    wb.save(OUT)
    print(f"yazıldı: {OUT.name}  (Bankai {len(rows_b)} satır, Quote {len(rows_q)} satır)")


if __name__ == "__main__":
    main()
