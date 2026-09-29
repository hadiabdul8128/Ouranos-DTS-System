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
