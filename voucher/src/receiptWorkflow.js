import { buildConfirmation } from './confirmation.js';
import { suggestAssignment } from './matching.js';
import { assessReceipt } from './receiptValidity.js';

/** Prepare the same one-click confirmation shown after an upload or photo scan. */
export function prepareReceipt(trip, extraction, receipt, expenses = [], purpose = '') {
  extraction = { ...extraction, validity: assessReceipt(extraction.rawText, extraction.fields) };
  const suggestion = suggestAssignment(trip, extraction.fields, purpose, expenses);
  return {
    receipt, extraction, extracted: true, editing: false, suggestion,
    existingExpenseId: suggestion.existingExpenseId,
    expense: { ...extraction.fields, purpose, category: suggestion.category, authorizationItemId: suggestion.authorizationItemId }
  };
}

/** Save a confirmed scan without making a reimbursement or compliance decision. */
export function confirmScannedReceipt(trip, expenses, pending, id) {
  if (!pending?.receipt || !pending.extraction) throw new Error('No scanned receipt is waiting for confirmation.');
  if (pending.existingExpenseId && !expenses.some(expense => expense.id === pending.existingExpenseId)) {
    throw new Error('The suggested expense is no longer in the ledger.');
  }
  const preview = buildConfirmation(trip, { ...pending.expense, receipt: pending.receipt }, expenses, pending.existingExpenseId);
  if (!preview.canConfirm) throw new Error(`Check the ${preview.missing.join(', ')} before confirming.`);
  if (preview.existing) {
    const updated = { ...preview.existing, receipt: pending.receipt, extraction: pending.extraction, purpose: pending.expense.purpose || preview.existing.purpose };
    return { expenses: expenses.map(expense => expense.id === updated.id ? updated : expense), expense: updated, attachedToExisting: true };
  }
  if (!id) throw new Error('A new expense needs an ID.');
  const expense = {
    ...pending.expense, id, tripId: trip?.id || null, amount: Number(pending.expense.amount),
    receipt: pending.receipt, extraction: pending.extraction,
    assignmentSource: pending.suggestion?.authorizationItemId ? 'auto' : 'manual',
    matching: pending.suggestion?.authorizationItemId
      ? { confidence: pending.suggestion.confidence, score: pending.suggestion.score, signals: pending.suggestion.signals }
      : { confidence: 'review', signals: [] }
  };
  return { expenses: [...expenses, expense], expense, attachedToExisting: false };
}
