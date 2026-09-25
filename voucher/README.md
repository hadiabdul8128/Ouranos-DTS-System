# Voucher Copilot

A self-contained voucher flow for an approved travel authorization. The repository still has no Dashboard or Authorization implementation, so this module keeps their integration boundary small and does not edit either teammate's area.

## Run

```sh
cd voucher
npm install
npm run dev
```

The page starts empty. Scan a real receipt or enter an expense before an authorization is available; saved expenses wait locally for an approved trip. Import an approved authorization JSON file later. The Voucher suggests matches for saved expenses when the trip loads. No trip or expenses are preloaded into the app.

## Authorization handoff

The Voucher expects an approved trip with this shape:

```json
{
  "id": "TDY-123",
  "authorizationId": "AUTH-123",
  "authorizationStatus": "Approved",
  "traveler": "Traveler Name",
  "origin": "Norfolk, VA",
  "destination": "San Diego, CA",
  "startDate": "2026-10-01",
  "endDate": "2026-10-04",
  "currency": "USD",
  "authorizedItems": [
    { "id": "hotel-1", "category": "lodging", "label": "Hotel", "amount": 540, "startDate": "2026-10-01", "endDate": "2026-10-04" }
  ]
}
```

`src/authorization.js` validates and normalizes the handoff. For integration, the Dashboard can navigate to `/voucher/?authorizationId=AUTH-123`; the Voucher requests `GET /api/authorizations/AUTH-123` from the same origin. The Authorization flow may also dispatch `window.dispatchEvent(new CustomEvent('ouranos:authorization-approved', { detail: approvedTrip }))` when mounted in the same page. The API and event producer do not exist in this repository yet.

## Receipt flow

1. Upload a photo, image, text receipt, or PDF. Image OCR runs in the browser using locally served worker, model, and language files. PDFs use embedded text when available and OCR for scanned pages (up to five pages).
2. Enter a short answer to **What was this for?** The extracted merchant, date, total, currency, category, payment method, and location are prefilled when present.
3. The matching engine uses that answer plus the scanned fields to suggest an approved item, or to attach the receipt to an existing expense without creating a duplicate. Ambiguous suggestions remain editable. Missing payment method or other facts are never invented.
4. Once all actual expenses are entered, mark intake complete. The voucher checks any approved items with no actual expense and asks the traveler to confirm they were unused.

`src/reconcile.js` makes deterministic, auditable validation decisions. The matching and text extraction are currently local heuristics plus OCR, not an LLM or a final reimbursement decision. Extraction quality varies with the receipt, so the traveler reviews each prefilled field before saving. Receipt data and voucher edits are kept in this browser tab's session storage and can be downloaded with the review package after an authorization is loaded and exceptions are resolved. This prototype has no DTS/Citi connection or approved storage and authentication controls for operational travel records. Do not use sensitive operational travel records for testing yet.

The OCR assets are copied from the installed `tesseract.js`, `tesseract.js-core`, and `@tesseract.js-data/eng` packages by `scripts/prepare-ocr.mjs` before development and production builds. They are served from `/ocr` so scans do not depend on a third-party OCR endpoint.

## Verify

```sh
npm test
npm run build
```
