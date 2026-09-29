# Voucher receipt currencies

Receipt review and Add/Edit expense offer a currency selector. Currency affects the original receipt total and lodging tax/fee fields. USD remains the authorization and reconciliation currency; Authorization UI and its contract are unchanged.

For a foreign receipt, the traveler enters the USD charge from their card statement or a documented conversion. Ouranos does not fetch exchange rates or treat the foreign numeric amount as USD. A documented conversion requires a source/rate/date note. The expense list shows both the USD total and original charge.

## Stored evidence

`expense.save` retains its existing `currency: "USD"` and `amountMinor` for the confirmed USD total. Optional `originalReceipt` records:

```json
{
  "currency": "EUR",
  "amountMinor": 10000,
  "taxesMinor": 1500,
  "feesMinor": 500,
  "usdBasis": "card_statement",
  "conversionNote": "USD 110.00 from card statement"
}
```

In that example top-level `amountMinor` is 11000, `taxesMinor` is 1650 and `feesMinor` is 550. The confirmed USD tax/fee allocation uses proportional integer rounding with a cumulative boundary so the parts cannot exceed the total. The server validates those parts. USD-only records need no new fields. Edits replace the expense payload, so changing back to USD removes original foreign details.

Supported currencies: USD, EUR, GBP, CAD, AUD, NZD, CHF, JPY, KRW, MXN, INR, AED, SAR, SGD, HKD, PHP, THB, TWD, CNY, BHD and KWD. JPY/KRW use zero decimal places; BHD/KWD use three; the remaining currencies use two. Ambiguous decimal notation must be corrected explicitly; amounts are never guessed.

Matching uses category, merchant and dates for foreign receipts and does not compare foreign amounts against USD authorization amounts. Existing deterministic reconciliation uses confirmed USD amounts.

Verification rule version `ouranos.voucher.verify.v2` compares high-confidence OCR money against the original receipt amount in the original currency. Reliable currency mismatches require correction. An optional `receiptCurrencyCorrection` explanation (at least eight characters) records an OCR currency error; it does not rewrite extraction evidence. Missing/uncertain OCR currency remains a warning and cannot count as an automatic total match for a foreign receipt. Provider fields/raw text and the submitted expense are preserved separately in the existing audit records and frozen snapshot. Ouranos verification does not establish DTS approval or independently verify a traveler-supplied exchange rate.

The optional expense fields use existing JSON storage and require the current API deployment, with no database migration.

## Planned expense currency

Authorization planning has one amount input and a currency selector per planned expense. Changing currency converts the displayed amount automatically. Editing a foreign amount recalculates its USD estimate. The former USD amount input and conversion-note input are removed; the USD approval budget and audit note are generated in the background. A small read-only USD estimate appears below foreign amounts.

The same-origin `/api/exchange-rates` endpoint fetches daily reference rates from [Frankfurter v2](https://frankfurter.dev/). Requests contain only currency codes, with no trip, traveler or expense amounts. No API key is required. The server validates positive rates, full currency coverage, duplicate entries and observation dates, caches successful responses, and returns an uncached 503 on failure. Missing or older-than-seven-day rates cannot silently relabel an existing amount; USD entry remains available, with a retry action for conversion. These are planning estimates, not guaranteed card settlement rates.

Conversions use integer minor units and round once in the target currency. Repeated currency switches preserve the canonical USD budget, avoiding accumulated rounding drift for JPY/KRW and BHD/KWD. Editing the number establishes a new USD estimate. The existing optional `approvedExpenseItems[].originalEstimate` stores the displayed foreign amount and a generated source/rate/date note. `authorizedAmountMinor` and the plan currency remain USD for approval and reconciliation. Existing saved estimates retain their USD budget until edited; loading current rates never silently reprices them.

Human approval routing is unchanged. Original quotes and generated notes remain in the frozen authorization. Voucher still reconciles actual receipts against the approved USD budget and preserves actual foreign receipt charges separately.
