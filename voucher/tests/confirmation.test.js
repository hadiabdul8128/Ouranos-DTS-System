import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfirmation } from '../src/confirmation.js';
import { normalizeAuthorization } from '../src/authorization.js';

test('confirmation preview uses reconciliation to explain a lodging overage', () => {
  const trip = normalizeAuthorization({ id: 'trip', authorizationStatus: 'Approved', origin: 'Norfolk', destination: 'San Diego', startDate: '2026-10-12', endDate: '2026-10-15', authorizedItems: [{ id: 'hotel', category: 'lodging', label: 'Marriott lodging', amount: 570, startDate: '2026-10-12', endDate: '2026-10-15' }] });
  const receipt = { merchant: 'Marriott', date: '2026-10-15', amount: 621, category: 'lodging', currency: 'USD', paymentMethod: 'gtcc', authorizationItemId: 'hotel', serviceStartDate: '2026-10-12', serviceEndDate: '2026-10-15' };
  const preview = buildConfirmation(trip, receipt);
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.item.id, 'hotel');
  assert.equal(preview.issues.find(issue => issue.code === 'over_authorization')?.difference, 51);
});

test('uncertain total cannot be confirmed without an entered amount', () => {
  const preview = buildConfirmation(null, { merchant: 'Parking Garage', date: '2026-10-12', amount: null });
  assert.equal(preview.canConfirm, false);
  assert.deepEqual(preview.missing, ['total']);
});
