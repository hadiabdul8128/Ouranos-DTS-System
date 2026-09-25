/**
 * Policy citations shown next to every check. Only paragraph numbers we have verified are cited;
 * everything else names its source document instead of guessing a paragraph.
 */
export const rules = {
  receipts: { cite: 'JTR 010301', text: 'Itemized receipt required for all lodging (any amount) and any single expense of $75 or more.' },
  lostReceipt: { cite: 'JTR 010301', text: 'If a receipt is lost or destroyed, a statement with the same information may be furnished.' },
  duplicate: { cite: 'JTR 010302', text: 'A traveler cannot be reimbursed more than once for the same allowance or expense.' },
  firstLastDay: { cite: 'GSA M&IE table', text: 'M&IE is 75% of the locality rate on the first and last day of travel.' },
  providedMeals: { cite: 'JTR ch. 2 (per diem)', text: 'Meals provided by the Government, directly or in a registration fee, are deducted from M&IE.' },
  lodgingTax: { cite: 'JTR ch. 2 · FTR 301-11.27', text: 'CONUS lodging taxes are not part of the lodging cap; they are reimbursed as a separate expense.' },
  lodgingCap: { cite: 'GSA/DTMO locality rate', text: 'Room cost above the nightly lodging cap needs actual-expense authorization.' },
  validReceipt: { cite: 'DTMO “What is a Valid Receipt?”', text: 'A valid receipt is itemized and shows the vendor, date, amount, and that it was paid.' }
};

export const disclaimer = 'Not affiliated with or endorsed by DoD, DTMO, DFAS, or Citi. Ouranos prepares your voucher; DTS remains the system of record and your AO makes the final decision.';
