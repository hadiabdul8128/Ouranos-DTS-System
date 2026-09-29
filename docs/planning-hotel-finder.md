# Hotels inside travel planning

The planning page now has a collapsed **Find hotels** panel. It mounts the existing hotel search only when opened, prefilled with the trip destination and displaying its travel dates. Location, ZIP and hotel-name filters, source listings, map links, booking guidance, loading states and retry controls are shared with the standalone hotel finder. Closing and reopening the panel preserves its filters.

**Use this hotel** fills a matching or unassigned lodging row, or adds a new lodging row if necessary. It retains existing amounts, currencies, conversion notes, payment choices and dates; unrelated budget rows and other named hotels are preserved. New rows inherit the trip's stay dates. After selection, the finder closes and the planned-expense section receives focus. Travelers enter/check the budget amount themselves: the GSA catalog supplies real property names/addresses, not live availability or hotel prices. Travelers enter their planned lodging budget manually.

For submitted/approved plans, searching remains available but adding a hotel is disabled. Authorization approval, submitted records, Dashboard navigation and Voucher reconciliation are unchanged. No API key, authentication change, backend change or database migration is required.

The meals and lodging estimate controls have been removed from travel forms. Previously saved expense amounts and allowance records are preserved.
