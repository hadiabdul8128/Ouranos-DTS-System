/** What DTS expects attached to a voucher (HQ RIO DTS Quick Guide, Step 17), limited to what applies to this trip. */
export type VoucherDocument={id:string;title:string;detail:string;optional:boolean;
 /** Set when Ouranos can tell on its own; otherwise the traveler ticks it off. */
 auto?:{done:boolean;note:string}};
type Expense={category:string;merchant:string;foreignCurrency:boolean};

export function voucherDocuments({travelMode,expenses,missingReceipts}:{travelMode?:string;expenses:Expense[];missingReceipts:string[]}):VoucherDocument[]{
 const docs:VoucherDocument[]=[
  {id:'orders',title:'Orders and every modification',detail:'Your AF Form 938 (or your service’s orders) plus all mods. Attach them in DTS under the Travel Orders expense type.',optional:false},
  {id:'receipts',title:'Receipts for airfare, lodging, rental car and anything $75 or more',detail:'Itemized, showing the vendor, date, amount and that it was paid.',optional:false,
   auto:!expenses.length?{done:false,note:'Add your expenses first.'}:missingReceipts.length?{done:false,note:`Still missing: ${[...new Set(missingReceipts)].join(', ')}`}:{done:true,note:'Every expense that needs one has a receipt.'}},
 ];
 if(travelMode==='pov')docs.push({id:'ctw',title:'Constructed Travel Worksheet (CTW)',detail:'Required for mileage claims when you drove instead of flying.',optional:false});
 if(expenses.some(e=>e.category==='lodging'))docs.push({id:'non_availability',title:'Lodging non-availability statement',detail:'Only if you booked lodging outside DTS. Covers DoD lodging, privatized Army lodging and DoD Preferred commercial lodging.',optional:true});
 docs.push({id:'fcal',title:'Fund Cite Authorization Letter (FCAL)',detail:'Only if the trip is paid from an outside funding source.',optional:true});
 if(expenses.some(e=>e.foreignCurrency))docs.push({id:'foreign_statement',title:'Card or bank statement for foreign-currency charges',detail:'Shows the exchange rate and the USD amount charged, plus any conversion fees. You can black out personal details.',optional:false});
 return docs;
}

export type DocumentMarks=Record<string,'done'|'na'>;
/** Ready when every document is attached, auto-checked, or marked as not applying. */
export function documentProgress(docs:VoucherDocument[],marks:DocumentMarks){
 const ready=docs.filter(doc=>doc.auto?doc.auto.done:Boolean(marks[doc.id])).length;
 return {ready,total:docs.length,complete:ready===docs.length};
}
