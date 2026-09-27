# Hotel discovery

The travel hub links to `/dashboard/travel/hotels`. The traveler selects a saved trip; its destination and dates prefill the hotel finder. When an authorization has lodging items, the page shows their total as a **planned** or **approved lodging budget**. It is not a hotel quote. A traveler can search another city or ZIP, prioritize a work ZIP within that city, and narrow by hotel name. The page offers property addresses, map links, and a copy action.

## Property data and refresh

The checked-in catalog at `public/lodging/fedrooms-2026.json` was generated from [GSA's FedRooms accepted-properties workbook](https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms), published August 31, 2026. It has 12,265 distinct property records. Its metadata includes the exact workbook URL, publication date, and SHA-256 digest. The importer rejects changed columns, incomplete properties, and unexpectedly small lists.

To refresh, verify GSA's latest workbook and publication date, update `SOURCE` and `PUBLISHED` in `scripts/update-fedrooms-catalog.py`, and run `python3 scripts/update-fedrooms-catalog.py /path/to/downloaded.xlsx`. Review the source and the generated diff before committing. The catalog is public property information; it contains no traveler data. It is loaded in the browser and searched locally.

## Booking boundary

The GSA list is a candidate list, **not** a live availability, price, distance, eligibility, or policy decision. A property may no longer participate. The finder never marks a hotel as approved, selects a reimbursable rate, or reserves a room. The traveler must check the applicable lodging priority and current inventory in [DTS](https://dtsproweb.defensetravel.osd.mil/dts-app/pubsite/all/view). [DTMO's Integrated Lodging Program guidance](https://www.travel.dod.mil/Programs/Lodging/ILP-site/) and [DoD lodging guidance](https://www.travel.dod.mil/Programs/Lodging/DoD-Lodging/) explain why DoD or DoD Preferred options may take priority over a FedRooms candidate. The page links to the [DoD Preferred resources](https://www.travel.dod.mil/Programs/Lodging/DoD-Preferred-Commercial-Lodging/Resources/).

This implementation does not use a DTS, GSA booking, or geocoding API. It does not send trip details to a hotel provider. Opening a map shares only the public property address with Google Maps. A future approved integration can replace the catalog/search adapter while preserving the trip context and booking boundary.

## Verification

`platform/tests/hotel-discovery.test.ts` exercises search, ambiguity, ZIP ranking, source validation, and overseas address handling against the real catalog. `platform/tests/hotel-trip.test.ts` covers trip prefill and approved versus draft lodging budgets.
