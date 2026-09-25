# Voucher Copilot

A self-contained voucher flow for an approved travel authorization. The repository still has no Dashboard or Authorization implementation, so this module keeps their integration boundary small and does not edit either teammate's area.

## Run

```sh
cd voucher
npm install
npm run dev
```

The page starts empty. Scan a receipt or enter an expense before an authorization is available; saved expenses wait locally for an approved trip. The Voucher suggests matches for saved expenses when the trip loads. No trip or expenses are preloaded into the app. JSON import remains available in development or with `?dev=1` for testing.

## Authorization handoff

The preferred handoff is the `TravelAuthorization` contract described in [AUTHORIZATION_INTEGRATION.md](AUTHORIZATION_INTEGRATION.md). Its shape is:

```json
{
  "tripId": "TDY-123",
  "authorizationId": "AUTH-123",
  "status": "Approved",
  "traveler": "Traveler Name",
  "origin": "Norfolk, VA",
  "destination": "San Diego, CA",
  "departureDate": "2026-10-01",
  "returnDate": "2026-10-04",
  "currency": "USD",
  "approvedExpenseItems": [
    { "id": "hotel-1", "category": "lodging", "description": "Marriott lodging", "authorizedAmount": 540, "merchant": "Marriott", "location": "San Diego, CA", "expectedPaymentMethod": "gtcc", "startDate": "2026-10-01", "endDate": "2026-10-04" }
  ]
}
```

`src/travelAuthorization.d.ts` defines the contract. `src/authorization.js` validates and normalizes it; `src/authorizationHandoff.js` loads it into Voucher regardless of source. The old JSON shape remains accepted. A same-page event, a temporary same-tab session handoff, and a future `GET /api/authorizations/:id` route all feed that adapter. The API and Authorization event producer do not exist in this repository yet.

## Receipt flow

1. Upload a photo, image, text receipt, or PDF. `src/receiptExtractor.d.ts` defines the replaceable extractor interface. The default local implementation runs image OCR in the browser using locally served worker, model, and language files. PDFs use embedded text when available and OCR for scanned pages (up to five pages). No external vision provider or API key is configured.
2. Review a compact confirmation card showing merchant, date or stay dates, paid total, category, and likely authorized item. Type an optional hint such as `parking` or `rental car gas` if the category is unclear. A clear receipt needs one confirmation click; unclear or missing values open in **Edit details**.
3. The parser prefers an explicit paid or final total over subtotal, tax, tip, or balance. Conflicting totals stay unfilled. It can also extract tax, fees, tip, subtotal, currency, location, address, payment method, and lodging dates when printed. Each saved expense keeps `extraction.rawText`, `extraction.fields`, `extraction.confidence` (high/medium/low per field), and `extraction.candidates` separately from the receipt image or PDF.
4. Matching uses approved category, merchant, location, dates, amount, and optional payment expectation. A close tie remains unassigned. Confirming an expense updates deterministic reconciliation; normal items stay in the ledger while exceptions appear at the top. Once intake is complete, the voucher also asks about approved items with no actual expense.

`src/reconcile.js` makes deterministic, auditable validation decisions. The matching and text extraction are currently local heuristics plus OCR, not an LLM or a final reimbursement decision. Extraction quality varies with the receipt, so the traveler reviews each prefilled field before saving. Receipt data and voucher edits are kept in this browser tab's session storage and can be downloaded with the review package after an authorization is loaded and exceptions are resolved. This prototype has no DTS/Citi connection or approved storage and authentication controls for operational travel records. Do not use sensitive operational travel records for testing yet.

`tests/integrationFixture.js` contains a test-only approved TDY and receipt texts. `tests/voucherFlow.test.js` walks approval handoff, receipt extraction, automatic assignment, the three exceptions, their resolution, and the ready-for-review state. No fixture is loaded by the production UI.

The OCR assets are copied from the installed `tesseract.js`, `tesseract.js-core`, and `@tesseract.js-data/eng` packages by `scripts/prepare-ocr.mjs` before development and production builds. They are served from `/ocr` so scans do not depend on a third-party OCR endpoint.

## Companion MVP (v0.1 in the DTS module brief)

- **Manual trip setup** (`src/tripSetup.js`): with no Authorization handoff, the traveler types a trip reference using facts from their approved DTS authorization. No orders image is captured, because orders can carry PII/CUI. Lodging and M&IE estimates come from the per-diem engine; other estimates come from the traveler. This entry has `status: "TravelerEntered"` and `entrySource: "traveler"` through normalization, reconciliation, UI, and exports. The official handoff still requires `status: "Approved"`. Manual entry does not verify approval or approved amounts. When a real approved authorization is loaded for the same trip, prior exception resolutions reopen for review. For compatibility, the JSON reconciliation total is still named `totals.authorized`; on a traveler-entered trip it represents the entered estimate.
- **Per-diem engine** (`src/perDiem.js`): CONUS lodging cap by night and season, and M&IE with first/last day at 75%. Provided meals are deducted using the GSA breakdown. Trips crossing Oct 1 use both fiscal-year tables. Long-term TDY (Lodging-Plus), the Government Meal Rate, OCONUS, and unknown localities are flagged, never estimated. Every day carries its source row.
- **Rate tables** (`src/rates/conus-fy*.js`) are generated from the official GSA Per Diem API. Refresh them with `GSA_API_KEY=... node scripts/fetch-gsa-rates.mjs 2027 2028` (DEMO_KEY works but is rate-limited). DTMO's lookup is authoritative for DoD, so the UI tells travelers to confirm there.
- **Policy checks** (`src/reconcile.js`, citations in `src/rules.js`):
  - Receipts per JTR 010301, or a lost-receipt statement (`src/lostReceipt.js`).
  - Duplicates per JTR 010302.
  - CONUS lodging tax split out of the room cost and never counted against the cap (`src/lodging.js`).
  - Room cost over the nightly cap.
  - Meals claimed above the M&IE allowance.
  - Valid-receipt heuristics at capture (`src/receiptValidity.js`) that flag reservation confirmations and card slips.
- **DTS entry checklist + evidence package** (`src/dtsChecklist.js`, `src/evidencePackage.js`): per diem, lodging (room and tax lines), other expenses, justifications, split disbursement, and receipts labeled R1…Rn with their SHA-256 capture hashes. Opens as a page to print or save as PDF. DTS category names are shown only where DTMO has confirmed them.
- **Encrypted backup** (`src/backup.js`): AES-256-GCM with a PBKDF2 passphrase, plus restore and delete-all. Storage stays in the session, so the backup is how a traveler keeps a copy.

## Verify

```sh
npm test
npm run build
```
