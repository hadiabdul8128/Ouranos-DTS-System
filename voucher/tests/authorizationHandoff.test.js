import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthorization } from '../src/authorizationHandoff.js';

const approved = {
  tripId: 'TDY-123', authorizationId: 'AUTH-123', traveler: 'Alex Morgan', status: 'Approved',
  origin: 'Raleigh, NC', destination: 'San Diego, CA', departureDate: '2026-10-12', returnDate: '2026-10-15', currency: 'USD',
  approvedExpenseItems: [{ id: 'hotel', category: 'lodging', description: 'Marriott lodging', authorizedAmount: 570, merchant: 'Marriott', startDate: '2026-10-12', endDate: '2026-10-15' }]
};

test('handoff matches saved receipts and an unconfirmed scan', () => {
  const state = {
    trip: null, expenses: [{ id: 'saved', merchant: 'Marriott San Diego', date: '2026-10-15', amount: 621, category: 'lodging', receipt: { name: 'folio.pdf' }, purpose: 'hotel' }],
    pending: { extracted: true, expense: { merchant: 'Marriott', date: '2026-10-15', amount: 621, category: 'lodging', purpose: 'hotel' }, extraction: { fields: { merchant: 'Marriott', date: '2026-10-15', amount: 621, category: 'lodging' } } },
    resolutions: {}, audit: []
  };
  const loaded = loadAuthorization(state, approved);
  assert.equal(loaded.trip.authorizationId, 'AUTH-123');
  assert.equal(loaded.expenses[0].authorizationItemId, 'hotel');
  assert.equal(loaded.expenses[0].tripId, 'TDY-123');
  assert.equal(loaded.pending.expense.authorizationItemId, 'hotel');
  assert.equal(loaded.pending.suggestion.authorizationItemId, 'hotel');
  assert.equal(state.trip, null);
});

test('handoff rejects a different trip with expenses unless explicitly replaced', () => {
  const current = loadAuthorization({ expenses: [], audit: [], resolutions: {} }, approved);
  current.expenses = [{ id: 'saved', category: 'lodging' }];
  const other = { ...approved, tripId: 'TDY-456', authorizationId: 'AUTH-456' };
  assert.throws(() => loadAuthorization(current, other), /explicit confirmation/);
  const replaced = loadAuthorization(current, other, { replaceTrip: true });
  assert.equal(replaced.expenses.length, 0);
  assert.equal(replaced.trip.id, 'TDY-456');
});

test('a revised approval reopens prior resolutions for deterministic review', () => {
  const current = loadAuthorization({ expenses: [], audit: [], resolutions: {} }, approved);
  current.intakeComplete = true;
  current.resolutions = { 'hotel-expense:over_authorization': { type: 'explanation', value: 'Old explanation for old approval' } };
  const revised = { ...approved, approvedExpenseItems: [{ ...approved.approvedExpenseItems[0], authorizedAmount: 550 }] };
  const reloaded = loadAuthorization(current, revised);
  assert.deepEqual(reloaded.resolutions, {});
  assert.equal(reloaded.intakeComplete, false);
});
