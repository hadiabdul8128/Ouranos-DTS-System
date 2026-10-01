# Flight suggestions

Destination and starting location are entered as a city plus a state or territory (or a city and country for travel outside the U.S.), so searches name a real place. Installation names such as "Fort Bragg, NC" return no flights; the form asks for the nearest city with an airport instead. New trips cannot start in the past, and plans whose dates have passed say so instead of searching, because Google Flights lists no fares for past dates. The planning screen shows **Suggested flights** under Starting location. Once the plan has a starting location, the trip's destination and dates are used to look up flights. The first result is Google's best pick; the lowest fare is also marked. Nothing is added to the plan until the traveler chooses a flight. Choosing one fills a single editable airfare row with the airline, route and price; choosing another replaces that row. Other airfare rows are left alone. The last starting location is remembered on the device so later plans show suggestions immediately.

## How results are gathered

`GET /api/flights?from=&to=&departure=&returnDate=` builds a plain-language Google Flights search (round trip when there is a return date, otherwise one way) and downloads the results page on the server. `packages/domain/flight-search.ts` reads each result's full-sentence `aria-label` for price, airline, stops, airports, times and duration, removes duplicates, and returns up to eight options in Google's order.

This is a scraper, not a supported API. If Google changes the wording of those labels, the dropdown reports that no flights were found until the pattern is updated. If Google blocks or times out the request, the dropdown reports that prices are unavailable and offers a retry; it never invents a fare. Requests from hosted servers may be blocked more often than local ones.

## Booking boundary

Suggestions are commercial fares for planning estimates. They are not GSA City Pair fares, availability, or an approval. The traveler books through DTS or their travel office. Only the starting location, destination and dates are sent to Google.

## Verification

`platform/tests/flight-search.test.ts` covers label parsing (including codeshares, entities and duplicates), search URLs, input validation and unavailable responses.

## Editing a trip

Until its authorization is submitted, a trip's destination, dates and purpose can be changed from **Edit trip** on the planning screen. Flight suggestions follow the new trip. If planned expense dates fall outside the new dates, planning says so before submission. Once the authorization is in review or approved, the trip is locked, matching the server's rule.

## Not flying

Planning asks **How are you getting there?**: Flying, Driving my own car, Rental car, Government vehicle, or Other (train, bus, ride). The answer is saved with the plan (`travelMode`) and shown on the inbox confirmation and the review page.

- **Flying** shows flight suggestions. Older plans with an airfare line open with Flying selected.
- **Driving my own car** asks for round-trip miles and the rate per mile (check the current rate with your travel office) and adds one editable "Mileage, own car" cost; the miles and rate are saved with the plan (`mileage`).
- **Rental car** adds rental car and fuel lines if the plan has none.
- **Government vehicle** and **Other** add nothing.

Choosing anything other than Flying turns an untouched, empty airfare line into a fitting category instead of leaving a stray airfare row. Lines with amounts are never changed.

