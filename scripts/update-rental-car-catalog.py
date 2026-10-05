"""Build the rental car counter catalog from the companies' own store locators.

Counters come from All the Places (CC0), which collects each company's public
location finder; town coordinates come from the Census Bureau's place gazetteer
and are used to find the counters nearest a trip destination. Locations only:
neither source has prices or availability.

Usage: python3 scripts/update-rental-car-catalog.py [cache-dir]
Downloads are kept in cache-dir (default .rental-cache) so a failed run resumes.
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

ATP_LATEST = "https://data.alltheplaces.xyz/runs/latest.json"
PLACES_SOURCE = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip"
# The companies on the U.S. Government Rental Car Agreement with a nationwide public locator.
SPIDERS = ["enterprise", "hertz", "avis", "national", "alamo"]
OUTPUT = Path(__file__).resolve().parents[1] / "public/travel/rental-cars-2026.json"
USER_AGENT = "Ouranos rental car catalog updater (https://github.com/hadiabdul8128/Ouranos-DTS-System)"
# Counters a traveler can't walk into: employer- or flight-only desks, trucks, exotics, body-shop replacement desks.
RESTRICTED = re.compile(r"\b(only|required|closed to public|empl|employees?|exotics?|trucks?|collision|body shop)\b", re.I)
AIRPORT = re.compile(r"\b(airport|intl|international|regional|municipal field)\b", re.I)


def fetch(url: str, path: Path) -> bytes:
    if not path.exists():
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            path.write_bytes(response.read())
    return path.read_bytes()


def place_name(name: str) -> str:
    """'Seattle city' -> 'Seattle', 'Nashville-Davidson metropolitan government (balance)' -> 'Nashville-Davidson'."""
    name = re.sub(r"\s*\(.*\)$", "", name)
    return re.sub(r"(\s+[a-z][a-z-]*)+$", "", name).strip()


def places(cache: Path) -> list[list]:
    with zipfile.ZipFile(io.BytesIO(fetch(PLACES_SOURCE, cache / "places.zip"))) as archive:
        text = archive.read(archive.namelist()[0]).decode("utf-8")
    rows, seen = [], set()
    for row in csv.DictReader(io.StringIO(text), delimiter="\t"):
        row = {key.strip(): value.strip() for key, value in row.items()}
        name, state = place_name(row["NAME"]), row["USPS"]
        if not name or (name.lower(), state) in seen:
            continue
        seen.add((name.lower(), state))
        rows.append([name, state, round(float(row["INTPTLAT"]), 3), round(float(row["INTPTLONG"]), 3)])
    return rows


def counters(cache: Path, run: str) -> list[list]:
    rows = []
    for spider in SPIDERS:
        data = json.loads(fetch(f"https://alltheplaces-data.openaddresses.io/runs/{run}/output/{spider}.geojson", cache / f"{run}-{spider}.geojson"))
        for feature in data["features"]:
            tags, geometry = feature["properties"], feature.get("geometry")
            if tags.get("addr:country") != "US" or not geometry or geometry.get("type") != "Point":
                continue
            lon, lat = geometry["coordinates"]
            branch = (tags.get("branch") or "").strip()
            branch = "" if branch.lower() in {"car rental", tags.get("brand", "").lower()} else branch
            street = tags.get("addr:street_address") or " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
            place = " ".join(filter(None, [tags.get("addr:state"), tags.get("addr:postcode")]))
            address = ", ".join(filter(None, [street, tags.get("addr:city"), place]))
            if RESTRICTED.search(f"{branch} {address}"):
                continue
            airport = 1 if AIRPORT.search(f"{branch} {tags.get('official_name', '')} {street}") else 0
            rows.append([tags.get("brand") or tags.get("name"), branch, address, round(lat, 4), round(lon, 4), airport, tags.get("phone") or "", tags.get("website") or ""])
    return sorted(rows)


def main() -> None:
    cache = Path(sys.argv[1] if len(sys.argv) > 1 else ".rental-cache")
    cache.mkdir(parents=True, exist_ok=True)
    run = json.loads(fetch(ATP_LATEST, cache / "latest.json"))["run_id"]
    catalog = {
        "source": f"Company store locators collected by All the Places (CC0), run {run}",
        "placesSource": PLACES_SOURCE,
        "retrieved": run[:10],
        "places": places(cache),
        "counters": counters(cache, run),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(catalog['counters'])} counters, {len(catalog['places'])} places -> {OUTPUT}")


if __name__ == "__main__":
    main()
