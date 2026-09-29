# Hotels inside travel planning

The planning page now has a collapsed **Find hotels** panel. It mounts the existing hotel search only when opened, prefilled with the trip destination and displaying its travel dates. Location, ZIP and hotel-name filters, source listings, map links, booking guidance, loading states and retry controls are shared with the standalone hotel finder. Closing and reopening the panel preserves its filters.

**Use this hotel** fills a matching or unassigned lodging row, or adds a new lodging row if necessary. It retains existing amounts, currencies, conversion notes, payment choices and dates; unrelated budget rows and other named hotels are preserved. New rows inherit the trip's stay dates. After selection, the finder closes and the planned-expense section receives focus. Travelers enter/check the budget amount themselves: the GSA catalog supplies real property names/addresses, not live availability or hotel prices. Applying the lodging allowance estimate reuses a selected hotel row with an empty USD amount instead of duplicating it.

For submitted/approved plans, searching remains available but adding a hotel is disabled. Authorization approval, submitted records, Dashboard navigation and Voucher reconciliation are unchanged. No API key, authentication change, backend change or database migration is required.

**Meals & lodging estimate** replaces the ambiguous **Rate estimate** label. This existing calculator estimates meals/incidentals and lodging limits from bundled GSA rate tables and trip dates, with provided-meal/government-mess settings. Its figures are estimates to check against official rates, not room-price quotes or exchange rates.
