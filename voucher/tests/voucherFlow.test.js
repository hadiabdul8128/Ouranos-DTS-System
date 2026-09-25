import test from 'node:test';
import assert from 'node:assert/strict';
import { authorization, receipts } from './integrationFixture.js';
import { loadAuthorization } from '../src/authorizationHandoff.js';
import { extractReceipt } from '../src/receipt.js';
import { prepareReceipt, confirmScannedReceipt } from '../src/receiptWorkflow.js';
import { buildConfirmation } from '../src/confirmation.js';
import { reconcile } from '../src/reconcile.js';
import { computePerDiem } from '../src/perDiem.js';

test('approved trip through scans, matching, exception fixes, and ready for review', async () => {
  let state = loadAuthorization({ expenses: [], resolutions: {}, audit: [], pending: null }, authorization);
  assert.equal(state.trip.destination, 'San Diego, CA');
  assert.equal(state.trip.authorizedItems.length, 5);

  async function scan(key, id, purpose = '') {
    const file = { name: `${key}.txt`, type: 'text/plain', text: async () => receipts[key] };
    const extraction = await extractReceipt(file);
    const pending = prepareReceipt(state.trip, extraction, { name: file.name }, state.expenses, purpose);
    const preview = buildConfirmation(state.trip, { ...pending.expense, receipt: pending.receipt }, state.expenses, pending.existingExpenseId);
    assert.equal(preview.canConfirm, true);
    const confirmed = confirmScannedReceipt(state.trip, state.expenses, pending, id);
    state = { ...state, expenses: confirmed.expenses };
    return { ...confirmed, preview };
  }

  const normal = await scan('outbound', 'flight-expense', 'outbound flight');
  assert.equal(normal.expense.authorizationItemId, 'flight-out');
  assert.equal(normal.preview.issues.length, 0);
  assert.equal(normal.expense.assignmentSource, 'auto');

  const hotel = await scan('hotel', 'hotel-expense');
  assert.equal(hotel.expense.authorizationItemId, 'hotel');
  assert.equal(hotel.expense.extraction.fields.taxes, 51);
  // $570 room + $51 occupancy tax: CONUS lodging tax is its own line, so the room is within the $570 authorized.
  assert.equal(hotel.preview.issues.some(issue => issue.code === 'over_authorization'), false);

  const rental = await scan('rental', 'rental-expense');
  assert.equal(rental.expense.authorizationItemId, 'rental');
  state.expenses.push({ id: 'parking-expense', tripId: state.trip.id, merchant: 'Harbor Parking Garage', date: '2026-10-13', amount: 75, currency: 'USD', category: 'parking', paymentMethod: 'personal', authorizationItemId: 'parking', receipt: null });
  const changedReturn = await scan('return', 'return-expense', 'return flight home');
  assert.equal(changedReturn.expense.authorizationItemId, 'flight-return');
  assert.ok(changedReturn.preview.issues.some(issue => issue.code === 'itinerary_changed'));

  const perDiem = computePerDiem({ startDate: state.trip.startDate, endDate: state.trip.endDate, destination: state.trip.destination });
  let result = reconcile(state.trip, state.expenses, {}, { intakeComplete: true, perDiem });
  assert.deepEqual(result.issues.map(issue => issue.code), ['receipt_missing', 'itinerary_changed']);
  assert.equal(result.issues[0].rule, 'JTR 010301');
  assert.deepEqual(result.checks.find(check => check.code === 'lodging_tax_split'), { expenseId: 'hotel-expense', code: 'lodging_tax_split', rule: 'JTR ch. 2 · FTR 301-11.27', room: 570, tax: 51 });
  assert.equal(result.checks.find(check => check.code === 'lodging_cap')?.lodging.cap, 624);
  assert.equal(result.ready, false);

  const parking = await scan('parking', 'unused-id');
  assert.equal(parking.attachedToExisting, true);
  assert.equal(parking.expense.id, 'parking-expense');
  assert.equal(state.expenses.length, 5);
  const resolutions = { 'return-expense:itinerary_changed': { type: 'confirmed_date', value: '2026-10-16' } };
  result = reconcile(state.trip, state.expenses, resolutions, { intakeComplete: true, perDiem });
  assert.equal(result.issues.length, 0);
  assert.equal(result.ready, true);
  assert.equal(result.checks.filter(check => check.resolved).length, 1);
});
