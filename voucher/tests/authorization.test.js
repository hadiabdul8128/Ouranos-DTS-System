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
