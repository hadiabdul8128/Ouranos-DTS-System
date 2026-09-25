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
    { "id": "hotel-1", "category": "lodging", "label": "Marriott lodging", "amount": 540, "merchant": "Marriott", "location": "San Diego, CA", "expectedPaymentMethod": "gtcc", "startDate": "2026-10-01", "endDate": "2026-10-04" }
  ]
}
```

`src/travelAuthorization.d.ts` defines the handoff contract. `src/authorization.js` validates and normalizes it. `departureDate` and `returnDate` are accepted as aliases for `startDate` and `endDate`. Per-item `merchant`, `location`, and `expectedPaymentMethod` are optional and improve matching or validation when known. For integration, the Dashboard can navigate to `/voucher/?authorizationId=AUTH-123`; the Voucher requests `GET /api/authorizations/AUTH-123` from the same origin. The Authorization flow may also dispatch `window.dispatchEvent(new CustomEvent('ouranos:authorization-approved', { detail: approvedTrip }))` when mounted in the same page. JSON import remains available during development. The API and event producer do not exist in this repository yet.

## Receipt flow

1. Upload a photo, image, text receipt, or PDF. Image OCR runs in the browser using locally served worker, model, and language files. PDFs use embedded text when available and OCR for scanned pages (up to five pages).
2. Review a compact confirmation card showing merchant, date or stay dates, paid total, category, and likely authorized item. Type an optional hint such as `parking` or `rental car gas` if the category is unclear. A clear receipt needs one confirmation click; unclear or missing values open in **Edit details**.
3. The parser prefers an explicit paid or final total over subtotal, tax, tip, or balance. Conflicting totals stay unfilled. It can also extract tax, fees, tip, subtotal, currency, location, address, payment method, and lodging dates when printed. Each saved expense keeps `extraction.rawText`, `extraction.fields`, `extraction.confidence` (high/medium/low per field), and `extraction.candidates` separately from the receipt image or PDF.
4. Matching uses approved category, merchant, location, dates, amount, and optional payment expectation. A close tie remains unassigned. Confirming an expense updates deterministic reconciliation; normal items stay in the ledger while exceptions appear at the top. Once intake is complete, the voucher also asks about approved items with no actual expense.

`src/reconcile.js` makes deterministic, auditable validation decisions. The matching and text extraction are currently local heuristics plus OCR, not an LLM or a final reimbursement decision. Extraction quality varies with the receipt, so the traveler reviews each prefilled field before saving. Receipt data and voucher edits are kept in this browser tab's session storage and can be downloaded with the review package after an authorization is loaded and exceptions are resolved. This prototype has no DTS/Citi connection or approved storage and authentication controls for operational travel records. Do not use sensitive operational travel records for testing yet.

The OCR assets are copied from the installed `tesseract.js`, `tesseract.js-core`, and `@tesseract.js-data/eng` packages by `scripts/prepare-ocr.mjs` before development and production builds. They are served from `/ocr` so scans do not depend on a third-party OCR endpoint.

## Verify

```sh
npm test
npm run build
```
