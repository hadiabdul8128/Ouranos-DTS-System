"""Build approximate US ZIP centers for local hotel discovery.

Source: GeoNames free postal code data, CC BY 4.0. Coordinates represent
postal-code areas, not individual hotel buildings or driving distance.
"""

from __future__ import annotations

import hashlib
import json
import sys
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
    with zipfile.ZipFile(BytesIO(data)) as archive:
        for number, line in enumerate(archive.read("US.txt").decode("utf-8").splitlines(), start=1):
            fields = line.split("\t")
            if len(fields) < 11:
                raise ValueError(f"Unexpected GeoNames row {number}")
            postal, latitude, longitude = fields[1], fields[9], fields[10]
            if len(postal) != 5 or not postal.isdigit():
                continue
            lat, lon = float(latitude), float(longitude)
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"Invalid coordinates in row {number}")
            points.setdefault(postal, [lat, lon])
    if len(points) < 30_000:
        raise ValueError("Unexpectedly small postal catalog; inspect the source")
    output = {
        "source": SOURCE,
        "license": "CC BY 4.0",
        "retrieved": date.today().isoformat(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "points": dict(sorted(points.items())),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Wrote {len(points)} ZIP centers to {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
