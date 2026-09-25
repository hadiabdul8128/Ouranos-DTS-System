# Authorization to Voucher handoff

Send one approved `TravelAuthorization` object. The TypeScript contract is in `src/travelAuthorization.d.ts`; `src/authorization.js` validates it at runtime. Dates are `YYYY-MM-DD`, amounts are USD numbers, and item IDs are unique.

```json
{
  "tripId": "TDY-123",
  "authorizationId": "AUTH-123",
  "traveler": "Alex Morgan",
  "origin": "Raleigh, NC",
  "destination": "San Diego, CA",
  "departureDate": "2026-10-12",
  "returnDate": "2026-10-15",
  "status": "Approved",
  "currency": "USD",
  "approvedExpenseItems": [
    {
      "id": "lodging-1",
      "category": "lodging",
      "description": "Marriott lodging",
      "authorizedAmount": 570,
      "merchant": "Marriott",
      "location": "San Diego, CA",
      "startDate": "2026-10-12",
      "endDate": "2026-10-15",
      "expectedPaymentMethod": "gtcc"
    }
  ]
}
```

`merchant`, `location`, item dates, `expectedPaymentMethod`, `nights`, and trip `purpose` are optional. Categories: `airfare`, `lodging`, `rental_car`, `fuel`, `meals`, `parking`, `ground_transport`, `baggage`, `other`. Payment methods: `gtcc`, `personal`. Only `Approved` and USD are accepted in this Voucher version. The older `id` / `startDate` / `endDate` / `authorizedItems` JSON remains accepted for developer import.

The pure `loadAuthorization(currentVoucherState, authorization)` adapter in `src/authorizationHandoff.js` validates and loads this object, matches receipts scanned before approval, and returns updated Voucher state. The Voucher UI calls this same adapter for every source:

- **Same mounted page:** `window.dispatchEvent(new CustomEvent('ouranos:authorization-approved', { detail: approvedAuthorization }))`.
- **Separate page on the same origin and tab, before a backend exists:** `sessionStorage.setItem('ouranos:approved-authorization:v1', JSON.stringify(approvedAuthorization)); location.assign('/voucher/');` Voucher consumes this once on load. This is a temporary development bridge, not durable storage.
- **Future backend:** Navigate to `/voucher/?authorizationId=AUTH-123` after the backend serves the exact object at `GET /api/authorizations/AUTH-123`. The endpoint does not exist in this repository yet.

The Dashboard only needs to open Voucher after approval. It need not transform the authorization. JSON import appears in local development or with `?dev=1` for testing; the production traveler flow waits for the handoff. Neither this contract nor the browser bridge supplies approved persistence, authentication, or DTS submission.
