/** Stable integration slots; partners implement screens against the API/SDK. */
export const modules = {
 planning:{id:'planning',contractVersion:'1.x',route:'/dashboard/travel/planning',entities:['trip','authorization'],commands:['trip.save','authorization.save','authorization.submit']},
 vouchers:{id:'vouchers',contractVersion:'1.x',route:'/dashboard/travel/vouchers',entities:['document','expense','voucher'],commands:['document.register','document.finalize','expense.save','voucher.save','voucher.submit']},
} as const;
