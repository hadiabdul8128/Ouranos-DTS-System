/**
 * Heuristic "is this a valid receipt?" check, run at capture so the traveler can ask for the
 * itemized copy while still at the counter. It flags; it never rejects on its own.
 */
export function assessReceipt(rawText = '', fields = {}) {
  const text = String(rawText || '');
  const problems = [];
  if (!fields.merchant) problems.push('The vendor name is not readable.');
  if (!fields.date && !fields.serviceEndDate) problems.push('No transaction date was found.');
  if (!(Number(fields.amount) > 0)) problems.push('No paid total was found.');

  if (fields.category === 'lodging') {
    if (/\b(?:reservation|confirmation (?:number|#|no)|booking confirmation|estimated (?:total|charges)|itinerary)\b/i.test(text) && !/\b(?:folio|balance\s*(?:due)?\s*[:$]?\s*0(?:\.00)?|paid)\b/i.test(text)) {
      problems.push('This looks like a reservation confirmation, not the final folio. Ask the front desk for the itemized folio at checkout.');
    } else if (!fields.serviceStartDate || !fields.serviceEndDate) {
      problems.push('Lodging receipts need the stay dates. Make sure the folio shows check-in, check-out, and each night.');
    }
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const cardSlip = /\b(?:auth(?:orization)? code|approval code|approved|card ?holder copy|customer copy|xx{2,}\d{4}|\*{4}\s?\d{4})\b/i.test(text);
  const itemized = lines.filter(line => /[a-z]{3}.*\d+[.,]\d{2}/i.test(line) && !/\b(?:total|tax|tip|balance|subtotal|change|tender)\b/i.test(line)).length > 0;
  if (cardSlip && !itemized && lines.length <= 12) problems.push('This looks like a card slip. Keep it, but also get the itemized receipt.');

  return { valid: problems.length === 0, problems, method: 'heuristic' };
}
