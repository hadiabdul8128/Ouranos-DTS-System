"""Build approximate US ZIP centers for local hotel discovery.

Source: GeoNames free postal code data, CC BY 4.0. Coordinates represent
postal-code areas, not individual hotel buildings or driving distance.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path

SOURCE = "https://download.geonames.org/export/zip/US.zip"
OUTPUT = Path(__file__).resolve().parents[1] / "public/lodging/us-postal-centroids.json"


def main() -> None:
    if len(sys.argv) > 1:
        data = Path(sys.argv[1]).read_bytes()
    else:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "Ouranos hotel finder (https://github.com/hadiabdul8128/Ouranos-DTS-System)"})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
    points: dict[str, list[float]] = {}
    city_points: dict[str, list[tuple[float, float]]] = {}
    city_labels: dict[str, tuple[str, str]] = {}
    with zipfile.ZipFile(BytesIO(data)) as archive:
        for number, line in enumerate(archive.read("US.txt").decode("utf-8").splitlines(), start=1):
            fields = line.split("\t")
            if len(fields) < 11:
                raise ValueError(f"Unexpected GeoNames row {number}")
            postal, city, state_name, state_code, latitude, longitude = fields[1], fields[2], fields[3], fields[4], fields[9], fields[10]
            if len(postal) != 5 or not postal.isdigit():
                continue
            lat, lon = float(latitude), float(longitude)
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"Invalid coordinates in row {number}")
            points.setdefault(postal, [lat, lon])
            if not city or not state_name or not state_code:
                continue
            folded = unicodedata.normalize("NFKD", city).encode("ascii", "ignore").decode().lower()
            folded = re.sub(r"[^a-z0-9]+", " ", folded).strip()
            key = f"{folded}|{state_code.lower()}"
            city_points.setdefault(key, []).append((lat, lon))
            city_labels[key] = (city, state_name)
    if len(points) < 30_000:
        raise ValueError("Unexpectedly small postal catalog; inspect the source")
    output = {
        "source": SOURCE,
        "license": "CC BY 4.0",
        "retrieved": date.today().isoformat(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "points": dict(sorted(points.items())),
        "cities": {
            key: [
                sorted(coordinate[0] for coordinate in locations)[len(locations) // 2],
                sorted(coordinate[1] for coordinate in locations)[len(locations) // 2],
                *city_labels[key],
            ]
            for key, locations in sorted(city_points.items())
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Wrote {len(points)} ZIP centers to {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
