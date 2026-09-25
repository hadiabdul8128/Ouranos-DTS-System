import { inferCategory } from './receipt.js';

const tokens = value => new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2) || []);
const overlap = (a, b) => [...tokens(a)].filter(word => tokens(b).has(word)).length;
const daysApart = (a, b) => a && b ? Math.abs((Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86400000) : Infinity;

export function suggestAssignment(trip, fields, purpose = '', expenses = []) {
  const purposeCategory = inferCategory(purpose);
  const category = purposeCategory !== 'other' ? purposeCategory : fields.category || 'other';
  const existing = expenses.map(expense => {
    let score = 0;
    if (expense.receipt) score -= 4;
    if (fields.amount != null && Math.abs(Number(fields.amount) - Number(expense.amount)) <= 0.01) score += 5;
    if (fields.date && fields.date === expense.date) score += 3;
    if (fields.merchant && overlap(fields.merchant, expense.merchant)) score += Math.min(3, overlap(fields.merchant, expense.merchant) * 2);
    if (category !== 'other' && category === expense.category) score += 2;
    return { id: expense.id, score };
  }).sort((a, b) => b.score - a.score);
  const existingExpenseId = existing[0]?.score >= 8 && existing[0].score - (existing[1]?.score || 0) >= 2 ? existing[0].id : '';

  const matches = (trip?.authorizedItems || []).map(item => {
    let score = 0;
    if (category !== 'other' && category === item.category) score += 5;
    if (purpose) score += Math.min(4, overlap(purpose, item.label) * 2);
    if (fields.date && item.date) score += daysApart(fields.date, item.date) <= 1 ? 3 : 0;
    if (fields.date && item.startDate && item.endDate && fields.date >= item.startDate && fields.date <= item.endDate) score += 2;
    if (fields.amount != null && item.amount > 0 && Number(fields.amount) <= item.amount * 1.1) score += 1;
    if (/return|inbound|home/i.test(purpose) && /return|inbound|home/i.test(item.label)) score += 5;
    if (/outbound|departure|depart/i.test(purpose) && /outbound|departure|depart/i.test(item.label)) score += 5;
    return { id: item.id, score };
  }).sort((a, b) => b.score - a.score);
  const top = matches[0];
  const authorizationItemId = top?.score >= 5 && top.score - (matches[1]?.score || 0) >= 2 ? top.id : '';
  return {
    category,
    existingExpenseId,
    authorizationItemId: existingExpenseId ? expenses.find(e => e.id === existingExpenseId)?.authorizationItemId || authorizationItemId : authorizationItemId,
    confidence: existingExpenseId || authorizationItemId ? 'high' : 'review',
    reason: existingExpenseId ? 'Matches an expense already in the ledger.' : authorizationItemId ? 'Matched to an approved authorization item.' : trip ? 'Choose the approved item before saving.' : 'Load an approved authorization to allocate this expense.'
  };
}
