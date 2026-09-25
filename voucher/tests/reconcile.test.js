import test from 'node:test';
import assert from 'node:assert/strict';
import { trip, seedExpenses } from '../src/data.js';
import { reconcile } from '../src/reconcile.js';
import { extractReceiptText } from '../src/receipt.js';

test('seed trip has exactly the three intended exceptions and auditable totals', () => {
  const result = reconcile(trip, seedExpenses);
  assert.deepEqual(result.issues.map(issue => issue.code), ['over_authorization', 'receipt_missing', 'itinerary_changed']);
  assert.deepEqual(result.totals, { authorized: 2119, actual: 2140, gtcc: 1755, traveler: 385 });
  assert.equal(result.ready, false);
});

test('the three targeted corrections produce a review-ready voucher', () => {
  const expenses = structuredClone(seedExpenses);
  expenses.find(e => e.id === 'exp-6').receipt = { name: 'parking.jpg' };
  const resolutions = {
    'exp-2:over_authorization': { type: 'explanation', value: 'Conference rate was unavailable.' },
    'exp-7:itinerary_changed': { type: 'confirmed_date', value: '2026-09-20' }
  };
  const result = reconcile(trip, expenses, resolutions);
  assert.equal(result.ready, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.checks.filter(check => check.resolved).length, 2);
});

test('duplicate, unauthorized, and unclassified payment are surfaced', () => {
  const expenses = structuredClone(seedExpenses);
  expenses.push({ ...expenses[0], id: 'duplicate', paymentMethod: '', category: 'other' });
  const codes = reconcile(trip, expenses).issues.map(issue => issue.code);
  assert.ok(codes.includes('possible_duplicate'));
  assert.ok(codes.includes('unauthorized'));
  assert.ok(codes.includes('payment'));
});

test('receipt text extraction produces editable structured fields', () => {
  const fields = extractReceiptText('Union Station Parking\nWashington, DC\n09/17/2026\nTotal $92.00\nPersonal card');
  assert.equal(fields.merchant, 'Union Station Parking');
  assert.equal(fields.date, '2026-09-17');
  assert.equal(fields.amount, 92);
  assert.equal(fields.category, 'parking');
  assert.equal(fields.paymentMethod, 'personal');
});

test('split charges are compared against the total authorized item', () => {
  const expenses = structuredClone(seedExpenses);
  expenses.find(e => e.id === 'exp-6').amount = 70;
  expenses.push({ ...expenses.find(e => e.id === 'exp-6'), id: 'parking-extra', amount: 60, merchant: 'Garage Annex', receipt: { name: 'annex.jpg' } });
  const issue = reconcile(trip, expenses).issues.find(x => x.id === 'parking-extra:over_authorization');
  assert.equal(issue?.difference, 38);
});

test('stale or empty resolutions do not clear exceptions', () => {
  const result = reconcile(trip, seedExpenses, {
    'exp-2:over_authorization': { type: 'explanation', value: 'short' },
    'exp-7:itinerary_changed': { type: 'confirmed_date', value: '2026-09-19' }
  });
  assert.deepEqual(result.issues.map(issue => issue.code), ['over_authorization', 'receipt_missing', 'itinerary_changed']);
});
