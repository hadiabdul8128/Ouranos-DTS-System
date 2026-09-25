import { reconcile } from './reconcile.js';

/** Preview the same deterministic exceptions that will appear after confirmation. */
export function buildConfirmation(trip, expense, expenses = [], existingExpenseId = '') {
  const existing = expenses.find(item => item.id === existingExpenseId);
  const candidate = existing ? { ...existing, receipt: expense.receipt || existing.receipt } : { ...expense, id: '__pending_receipt__', tripId: trip?.id || null, receipt: expense.receipt || { name: 'pending receipt' } };
  const missing = [];
  if (!candidate.merchant?.trim()) missing.push('merchant');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date || '')) missing.push('date');
  if (!Number.isFinite(Number(candidate.amount)) || Number(candidate.amount) <= 0) missing.push('total');
  const item = trip?.authorizedItems.find(line => line.id === candidate.authorizationItemId) || null;
  const previewExpenses = existing ? expenses.map(row => row.id === existing.id ? candidate : row) : [...expenses, candidate];
  const issues = trip && !missing.length ? reconcile(trip, previewExpenses, {}, { intakeComplete: false }).issues.filter(issue => issue.expenseId === candidate.id) : [];
  return { canConfirm: missing.length === 0, missing, item, issues, existing };
}
