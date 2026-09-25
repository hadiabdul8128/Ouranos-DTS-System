import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthorization } from '../src/authorization.js';
import { trip } from './fixtures.js';
import { reconcile } from '../src/reconcile.js';

test('approved authorization can become an empty voucher trip', () => {
  const imported = normalizeAuthorization({ trip });
  assert.equal(imported.authorizationId, trip.authorizationId);
  assert.equal(imported.authorizedItems.length, 9);
  assert.equal(reconcile(imported, []).ready, false);
});

test('unapproved and incomplete authorizations are rejected', () => {
  assert.throws(() => normalizeAuthorization({ ...trip, authorizationStatus: 'Draft' }), /approved/);
  assert.throws(() => normalizeAuthorization({ ...trip, authorizedItems: [] }), /expense item/);
});

test('finished intake accounts for authorized items with no actual expense', () => {
  const imported = normalizeAuthorization({ trip });
  const oneExpense = [{ id: 'one', tripId: imported.id, date: imported.startDate, merchant: 'American Airlines', amount: 380, currency: 'USD', category: 'airfare', paymentMethod: 'gtcc', receipt: { name: 'flight.pdf' }, authorizationItemId: 'air-out' }];
  const result = reconcile(imported, oneExpense, {}, { intakeComplete: true });
  assert.equal(result.ready, false);
  assert.equal(result.issues.filter(issue => issue.code === 'authorized_item_unaccounted').length, 8);
  const resolutions = Object.fromEntries(imported.authorizedItems.slice(1).map(item => [`auth:${item.id}:not_used`, { type: 'not_used', value: item.id }]));
  assert.equal(reconcile(imported, oneExpense, resolutions, { intakeComplete: true }).ready, true);
});

test('authorization handoff keeps matching details and accepts departure aliases', () => {
  const { startDate, endDate, ...source } = trip;
  const imported = normalizeAuthorization({
    ...source, departureDate: startDate, returnDate: endDate,
    authorizedItems: [{ id: 'rental', category: 'rental_car', label: 'Rental car', amount: 284, merchant: 'Hertz', location: 'San Diego, CA', expectedPaymentMethod: 'gtcc' }]
  });
  assert.equal(imported.startDate, startDate);
  assert.equal(imported.endDate, endDate);
  assert.deepEqual(imported.authorizedItems[0], { id: 'rental', category: 'rental_car', description: 'Rental car', authorizedAmount: 284, label: 'Rental car', amount: 284, merchant: 'Hertz', location: 'San Diego, CA', expectedPaymentMethod: 'gtcc' });
  const mismatched = [{ id: 'rental-actual', tripId: imported.id, date: imported.startDate, merchant: 'Hertz', amount: 284, currency: 'USD', category: 'rental_car', paymentMethod: 'personal', receipt: { name: 'rental.pdf' }, authorizationItemId: 'rental' }];
  assert.ok(reconcile(imported, mismatched).issues.some(issue => issue.code === 'payment_expectation'));
});

test('canonical TravelAuthorization is validated and keeps existing Voucher aliases', () => {
  const input = {
    tripId: 'TDY-123', authorizationId: 'AUTH-123', traveler: 'Alex Morgan', status: 'Approved',
    origin: 'Raleigh, NC', destination: 'San Diego, CA', departureDate: '2026-10-12', returnDate: '2026-10-15', currency: 'USD',
    approvedExpenseItems: [{ id: 'lodging', category: 'lodging', description: 'Marriott lodging', authorizedAmount: 570, merchant: 'Marriott', startDate: '2026-10-12', endDate: '2026-10-15' }]
  };
  const normalized = normalizeAuthorization(input);
  assert.equal(normalized.tripId, input.tripId);
  assert.equal(normalized.id, input.tripId);
  assert.equal(normalized.startDate, input.departureDate);
  assert.equal(normalized.authorizedItems[0].amount, 570);
  assert.equal(normalized.approvedExpenseItems[0].description, 'Marriott lodging');
  assert.throws(() => normalizeAuthorization({ ...input, status: 'Draft' }), /approved/);
  assert.throws(() => normalizeAuthorization({ ...input, traveler: '' }), /traveler/);
  assert.throws(() => normalizeAuthorization({ ...input, departureDate: '2026-02-30' }), /valid travel dates/);
  assert.throws(() => normalizeAuthorization({ ...input, approvedExpenseItems: [{ ...input.approvedExpenseItems[0], authorizedAmount: '570' }] }), /authorized amount/);
  assert.throws(() => normalizeAuthorization({ ...input, approvedExpenseItems: [{ ...input.approvedExpenseItems[0], endDate: '2026-02-30' }] }), /invalid endDate/);
  assert.throws(() => normalizeAuthorization({ ...input, approvedExpenseItems: [{ ...input.approvedExpenseItems[0], merchant: 42 }] }), /invalid merchant/);
  assert.throws(() => normalizeAuthorization({ ...input, approvedExpenseItems: [...input.approvedExpenseItems, input.approvedExpenseItems[0]] }), /unique ID/);
});
