# Standalone hotel discovery

Open `/dashboard/travel/hotels` and enter a US city and state or five-digit ZIP. No trip or authorization is required. The optional worksite ZIP changes the search center; a distance selector and hotel-name filter narrow the results. Dates are optional for the FedRooms property list and required for live room offers.

## Property list

`public/lodging/fedrooms-2026.json` was generated from [GSA's FedRooms accepted-properties workbook](https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms), published August 31, 2026. Its 12,265 records contain names and addresses, not rates, photos, ratings, or current availability. `scripts/update-fedrooms-catalog.py` validates a replacement workbook before generating the catalog.

`public/lodging/us-postal-centroids.json` contains 41,488 US postal-code centers from [GeoNames](https://www.geonames.org/export/) (CC BY 4.0). `scripts/update-us-postal-centroids.py` can regenerate it from the source ZIP file. Nearby ranking uses approximate postal-center distances; it is not a driving-distance calculation or a property geocode. The UI says so. Both files are public and searched in the browser; no traveler data is stored for a hotel search.

## Live offers

The optional server-side adapter uses [Booking.com Demand API 3.2](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties) to search by coordinates and stay dates. It requests [accommodation details and photos](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details) for priced results, then shows a public total for the stay, guest review score, stars, photo, and offer link when those fields exist. Missing or invalid values stay absent. These public offers are separate from GSA listings and are **not** identified as government rates or policy-compliant options.

An approved Demand API partner account supplies `BOOKING_DEMAND_API_KEY` and `BOOKING_DEMAND_AFFILIATE_ID` in the **server** environment. No credentials are embedded in the browser. `BOOKING_DEMAND_MODE=production` is the default; sandbox mode is only for development and is labeled as test inventory. Without credentials, the route returns `unavailable`, and the page continues showing sourced FedRooms listings with an honest message that live prices, photos, and ratings are not connected. The browser sends only search coordinates and dates to Ouranos; when configured, the server sends those search parameters to Booking.com. Search responses are not persisted.

## Booking boundary

The page does not reserve rooms, decide reimbursement, or determine which lodging is authorized. Travelers should check applicable lodging priority and current inventory in [DTS](https://dtsproweb.defensetravel.osd.mil/dts-app/pubsite/all/view). [DTMO's Integrated Lodging Program guidance](https://www.travel.dod.mil/Programs/Lodging/ILP-site/) explains why DoD or DoD Preferred lodging may take priority. Opening a map shares the public property address with Google Maps.

## Verification

`platform/tests/hotel-discovery.test.ts` covers the GSA catalog. `platform/tests/hotel-nearby.test.ts` covers independent city and ZIP search. `platform/tests/hotel-provider.test.ts` covers live-offer mapping and rejects questionable prices. The older `platform/tests/hotel-trip.test.ts` remains to protect the separate optional trip helper even though this page no longer requires a trip.
