"""Convert GSA's public FedRooms workbook into a compact, audited search catalog.

Run after checking the date of GSA's published property list. No workbook parser
dependency is needed; this script reads the XLSX XML directly.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


SOURCE = "https://www.gsa.gov/system/files/2026_08-31-2026%20FedRooms%20Accepted%20Properties.xlsx"
PUBLISHED = "2026-08-31"
OUTPUT = Path(__file__).resolve().parents[1] / "public/lodging/fedrooms-2026.json"
XML_NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
HEADERS = ["Hotel Name", "Address", "Postal City", "State", "Zip", "Country"]


def workbook_bytes() -> bytes:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_bytes()
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "Ouranos hotel catalog updater (https://github.com/hadiabdul8128/Ouranos-DTS-System)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def extract_rows(data: bytes) -> list[list[str]]:
    from io import BytesIO

    with zipfile.ZipFile(BytesIO(data)) as workbook:
        strings = ["".join(item.itertext()) for item in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("x:si", XML_NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//x:sheetData/x:row", XML_NS):
            values = {}
            for cell in row.findall("x:c", XML_NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                value = cell.find("x:v", XML_NS)
                raw = value.text if value is not None and value.text else ""
                values[column] = strings[int(raw)] if cell.attrib.get("t") == "s" and raw else raw
            rows.append([values.get(column, "").strip() for column in "ABCDEF"])
        return rows


def main() -> None:
    data = workbook_bytes()
    rows = extract_rows(data)
    if not rows or rows[0] != HEADERS:
        raise ValueError("GSA workbook columns changed; inspect the source before updating the catalog")
    properties = []
    seen = set()
    for number, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue
        name, address, city, state, postal, country = row
        if not (name and address and city and country):
            raise ValueError(f"Incomplete property in source row {number}")
        if country == "United States" and postal.isdigit() and len(postal) < 5:
            postal = postal.zfill(5)
        entry = (name, address, city, state, postal, country)
        if entry not in seen:
            seen.add(entry)
            properties.append(entry)
    if len(properties) < 10_000:
        raise ValueError("Unexpectedly small catalog; inspect the workbook before publishing")
    properties.sort(key=lambda entry: (entry[5].casefold(), entry[3].casefold(), entry[2].casefold(), entry[0].casefold()))
    catalog = {
        "source": SOURCE,
        "published": PUBLISHED,
        "sha256": hashlib.sha256(data).hexdigest(),
        "properties": properties,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(properties)} real GSA property records to {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
