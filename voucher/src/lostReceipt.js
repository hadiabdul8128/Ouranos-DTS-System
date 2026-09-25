import { rules } from './rules.js';
import { formatDate } from './reconcile.js';

/** Build the lost-receipt statement the JTR allows, carrying the same facts the receipt would have. */
export function buildLostReceiptStatement(expense, { reason, traveler = '', signedAt = new Date().toISOString() } = {}) {
  const why = String(reason || '').trim();
  if (why.length < 8) throw new Error('Explain briefly how the receipt was lost (at least 8 characters).');
  if (!expense?.merchant || !expense?.date || !(Number(expense.amount) > 0)) throw new Error('The expense needs a vendor, date, and amount before a statement can be written.');
  const statement = {
    type: 'lost_receipt_statement', basis: rules.lostReceipt.cite,
    vendor: expense.merchant, date: expense.date, amount: Number(expense.amount), category: expense.category,
    paymentMethod: expense.paymentMethod || '', reason: why, traveler, signedAt
  };
  statement.text = [
    'LOST RECEIPT STATEMENT',
    `I certify that I incurred the following official travel expense and that the itemized receipt was lost or destroyed (${rules.lostReceipt.cite}).`,
    `Vendor: ${statement.vendor}`,
    `Date: ${formatDate(statement.date)}`,
    `Amount: $${statement.amount.toFixed(2)}`,
    `Expense type: ${String(statement.category || '').replaceAll('_', ' ')}`,
    statement.paymentMethod ? `Paid with: ${statement.paymentMethod === 'gtcc' ? 'Government Travel Charge Card' : 'personal funds'}` : '',
    `How the receipt was lost: ${why}`,
    `Traveler: ${traveler || '______________________'}    Signature: ______________________    Date: ${formatDate(signedAt.slice(0, 10))}`
  ].filter(Boolean).join('\n');
  return statement;
}
