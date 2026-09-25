import test from 'node:test';
import assert from 'node:assert/strict';
import { authorization } from './integrationFixture.js';
import { normalizeAuthorization } from '../src/authorization.js';
import { computePerDiem } from '../src/perDiem.js';
import { analyzeLodging } from '../src/lodging.js';
import { reconcile } from '../src/reconcile.js';
import { assessReceipt } from '../src/receiptValidity.js';
import { parseReceiptText } from '../src/receiptParser.js';
import { buildLostReceiptStatement } from '../src/lostReceipt.js';

const trip = normalizeAuthorization(authorization);
const perDiem = computePerDiem({ startDate: trip.startDate, endDate: trip.endDate, destination: trip.destination });
const hotel = { id: 'h', tripId: trip.id, merchant: 'Marriott', date: '2026-10-15', amount: 750, taxes: 60, currency: 'USD', category: 'lodging', paymentMethod: 'gtcc', authorizationItemId: 'hotel', serviceStartDate: '2026-10-12', serviceEndDate: '2026-10-15', receipt: { name: 'folio.pdf' } };

test('lodging splits room from tax and compares room to the nightly cap', () => {
  const lodging = analyzeLodging(hotel, perDiem);
  assert.deepEqual({ room: lodging.room, tax: lodging.tax, nights: lodging.nights, cap: lodging.cap, overCap: lodging.overCap }, { room: 690, tax: 60, nights: 3, cap: 624, overCap: 66 });
  const result = reconcile(trip, [hotel], {}, { perDiem });
  const issue = result.issues.find(item => item.code === 'lodging_over_cap');
  assert.equal(issue.overCap, 66);
  assert.equal(result.issues.some(item => item.code === 'over_authorization'), false, 'one explanation, not two, for the same overage');
  assert.match(issue.message, /actual-expense authorization/);
  const resolved = reconcile(trip, [hotel], { 'h:lodging_over_cap': { type: 'explanation', value: 'Only hotel with rooms during the event.' }, 'h:over_authorization': { type: 'explanation', value: 'Only hotel with rooms during the event.' } }, { perDiem });
  assert.equal(resolved.issues.length, 0);
});

test('a lost-receipt statement clears the missing receipt only for the same facts', () => {
  const parking = { id: 'p', tripId: trip.id, merchant: 'Harbor Parking', date: '2026-10-13', amount: 75, currency: 'USD', category: 'parking', paymentMethod: 'personal', authorizationItemId: 'parking', receipt: null };
  const statement = buildLostReceiptStatement(parking, { reason: 'Receipt blew away at the pay station.', traveler: 'Alex Morgan' });
  assert.match(statement.text, /LOST RECEIPT STATEMENT[\s\S]*JTR 010301[\s\S]*Harbor Parking[\s\S]*\$75\.00/);
  assert.equal(reconcile(trip, [parking], { 'p:receipt_missing': { type: 'lost_receipt_statement', value: statement } }).issues.length, 0);
  const changed = { ...parking, amount: 80 };
  assert.ok(reconcile(trip, [changed], { 'p:receipt_missing': { type: 'lost_receipt_statement', value: statement } }).issues.some(issue => issue.code === 'receipt_missing'));
  assert.throws(() => buildLostReceiptStatement(parking, { reason: 'lost' }), /at least 8/);
});

test('reservation confirmations and card slips are flagged at capture', () => {
  const confirmation = 'Marriott San Diego\nReservation Confirmation Number 88412\nCheck-in 10/12/2026\nCheck-out 10/15/2026\nEstimated total $621.00';
  const parsed = parseReceiptText(confirmation);
  assert.match(assessReceipt(confirmation, parsed.fields).problems.join(' '), /reservation confirmation/);
  const slip = 'SHELL\nDate 10/13/2026\nVISA ************4821\nAUTH CODE 044211\nTotal $81.40\nAPPROVED';
  assert.match(assessReceipt(slip, parseReceiptText(slip).fields).problems.join(' '), /card slip/);
  const folio = 'Marriott San Diego\nCheck-in 10/12/2026\nCheck-out 10/15/2026\nRoom 10/12 $190.00\nRoom 10/13 $190.00\nRoom 10/14 $190.00\nOccupancy Tax $51.00\nTotal paid $621.00\nBalance $0.00';
  assert.equal(assessReceipt(folio, parseReceiptText(folio).fields).valid, true);
});

test('an invalid required receipt becomes an exception until replaced or confirmed', () => {
  const expense = { ...hotel, amount: 621, taxes: 51, receipt: { name: 'confirmation.pdf' }, extraction: { validity: { valid: false, problems: ['This looks like a reservation confirmation, not the final folio.'] } } };
  const issue = reconcile(trip, [expense]).issues.find(item => item.code === 'receipt_not_itemized');
  assert.equal(issue.rule, 'DTMO “What is a Valid Receipt?”');
  assert.equal(reconcile(trip, [expense], { 'h:receipt_not_itemized': { type: 'confirmed_valid', value: 'confirmation.pdf' } }).issues.length, 0);
  const typedIn = { ...expense, extraction: { validity: { valid: false, problems: ['No paid total was found.'] } } };
  assert.equal(reconcile(trip, [typedIn]).issues.some(item => item.code === 'receipt_not_itemized'), false, 'traveler-entered total clears a missing-total flag');
});

test('meals above the computed M&IE allowance are flagged', () => {
  const withMeals = { ...trip, authorizedItems: [...trip.authorizedItems, { id: 'mie', category: 'meals', label: 'M&IE', amount: 301 }] };
  const meals = { id: 'm', tripId: trip.id, merchant: 'Meals & incidentals', date: '2026-10-15', amount: 344, currency: 'USD', category: 'meals', paymentMethod: 'personal', authorizationItemId: 'mie', receipt: null };
  const issue = reconcile(withMeals, [meals], {}, { perDiem }).issues.find(item => item.code === 'mie_over_entitlement');
  assert.equal(issue.allowance, 301);
  assert.equal(reconcile(withMeals, [{ ...meals, amount: 301 }], {}, { perDiem }).issues.length, 0);
});

test('duplicates cite JTR 010302', () => {
  const parking = { id: 'a', tripId: trip.id, merchant: 'Harbor Parking', date: '2026-10-13', amount: 20, currency: 'USD', category: 'parking', paymentMethod: 'personal', authorizationItemId: 'parking', receipt: null };
  const issue = reconcile(trip, [parking, { ...parking, id: 'b' }]).issues.find(item => item.code === 'possible_duplicate');
  assert.equal(issue.rule, 'JTR 010302');
});
