import { inferCategory } from './receiptParser.js';

const tokens = value => new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2) || []);
const overlap = (a, b) => [...tokens(a)].filter(word => tokens(b).has(word)).length;
const daysApart = (a, b) => a && b ? Math.abs((Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86400000) : Infinity;

/** Suggest a line item; an ambiguous tie remains unassigned for traveler review. */
export function suggestAssignment(trip, fields, purpose = '', expenses = []) {
  const purposeCategory = inferCategory(purpose);
  const category = purposeCategory !== 'other' ? purposeCategory : fields.category || 'other';
  const existing = expenses.filter(expense => !expense.receipt).map(expense => {
    let score = 0;
    if (fields.amount != null && Math.abs(Number(fields.amount) - Number(expense.amount)) <= 0.01) score += 5;
    if (fields.date && fields.date === expense.date) score += 3;
    if (fields.merchant) score += Math.min(3, overlap(fields.merchant, expense.merchant) * 2);
    if (category !== 'other' && category === expense.category) score += 2;
    return { id: expense.id, score };
  }).sort((a, b) => b.score - a.score);
  const existingExpenseId = existing[0]?.score >= 8 && existing[0].score - (existing[1]?.score || 0) >= 2 ? existing[0].id : '';

  const matches = (trip?.authorizedItems || []).filter(item => category === 'other' || item.category === category).map(item => {
    let score = 0;
    const signals = [];
    if (category !== 'other') { score += 6; signals.push('category'); }
    const merchantHits = overlap(fields.merchant, `${item.merchant || ''} ${item.label}`);
    if (merchantHits) { score += Math.min(6, merchantHits * 3); signals.push('merchant'); }
    const purposeHits = overlap(purpose, item.label);
    if (purposeHits) { score += Math.min(4, purposeHits * 2); signals.push('purpose'); }
    const locationHits = overlap(fields.location, item.location);
    if (locationHits) { score += Math.min(3, locationHits * 2); signals.push('location'); }
    if (item.date && fields.date) {
      const distance = daysApart(fields.date, item.date);
      if (distance === 0) { score += 4; signals.push('date'); }
      else if (distance <= 1) { score += 1; signals.push('near date'); }
    }
    if (item.startDate && item.endDate) {
      if (fields.serviceStartDate === item.startDate && fields.serviceEndDate === item.endDate) { score += 4; signals.push('stay dates'); }
      else if (fields.date >= item.startDate && fields.date <= item.endDate) { score += 2; signals.push('travel dates'); }
    }
    if (fields.amount != null && item.amount > 0) {
      const difference = Math.abs(Number(fields.amount) - item.amount);
      if (difference <= 1) { score += 3; signals.push('amount'); }
      else if (difference / item.amount <= 0.1) { score += 1; signals.push('near amount'); }
    }
    for (const direction of ['return|inbound|home', 'outbound|departure|depart']) {
      const pattern = new RegExp(direction, 'i');
      if (pattern.test(purpose)) score += pattern.test(item.label) ? 4 : -3;
    }
    if (item.expectedPaymentMethod && fields.paymentMethod === item.expectedPaymentMethod) { score += 1; signals.push('payment'); }
    return { id: item.id, score, signals };
  }).sort((a, b) => b.score - a.score);
  const top = matches[0];
  const margin = top ? top.score - (matches[1]?.score ?? -Infinity) : 0;
  const authorizationItemId = top && top.score >= 6 && margin >= 2 ? top.id : '';
  const matchedItem = (trip?.authorizedItems || []).find(item => item.id === authorizationItemId);
  const confidence = existingExpenseId || (authorizationItemId && top.score >= 9 && margin >= 3) ? 'high' : authorizationItemId ? 'medium' : 'review';
  return {
    category,
    existingExpenseId,
    authorizationItemId: existingExpenseId ? expenses.find(expense => expense.id === existingExpenseId)?.authorizationItemId || authorizationItemId : authorizationItemId,
    confidence,
    score: top?.score || 0,
    signals: top?.signals || [],
    reason: existingExpenseId ? 'Matches an expense already in the ledger.' : matchedItem ? `Matched to ${matchedItem.label}.` : trip ? trip.entrySource === 'traveler' ? 'Choose the entered trip item before saving.' : 'Choose the approved item before saving.' : 'Load an approved authorization to allocate this expense.'
  };
}
