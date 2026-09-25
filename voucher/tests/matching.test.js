import test from 'node:test';
import assert from 'node:assert/strict';
import { trip, seedExpenses } from './fixtures.js';
import { suggestAssignment } from '../src/matching.js';

test('scanned parking receipt matches an existing expense without creating a duplicate', () => {
  const suggestion = suggestAssignment(trip, { merchant: 'Union Station Parking', date: '2026-09-17', amount: 92, category: 'parking' }, 'Parking for conference', seedExpenses);
  assert.equal(suggestion.existingExpenseId, 'exp-6');
  assert.equal(suggestion.authorizationItemId, 'parking');
  assert.equal(suggestion.confidence, 'high');
});

test('purpose disambiguates return flight from outbound flight', () => {
  const suggestion = suggestAssignment(trip, { merchant: 'American Airlines', date: '2026-09-20', amount: 415, category: 'airfare' }, 'Return flight home', []);
  assert.equal(suggestion.category, 'airfare');
  assert.equal(suggestion.authorizationItemId, 'air-return');
});

test('ambiguous receipt is left for traveler review', () => {
  const suggestion = suggestAssignment(trip, { merchant: '', date: '', amount: null, category: 'other' }, 'work expense', []);
  assert.equal(suggestion.authorizationItemId, '');
  assert.equal(suggestion.existingExpenseId, '');
  assert.equal(suggestion.confidence, 'review');
});

test('a receipt can be categorized before an authorization is available', () => {
  const receipt = { merchant: 'Metro Parking Garage', date: '2026-09-18', amount: 18.5, category: 'other' };
  const staged = suggestAssignment(null, receipt, 'Parking at the meeting', []);
  assert.equal(staged.category, 'parking');
  assert.equal(staged.authorizationItemId, '');
  const assigned = suggestAssignment(trip, { ...receipt, category: staged.category }, 'Parking at the meeting', []);
  assert.equal(assigned.authorizationItemId, 'parking');
});

test('Marriott folio matches lodging despite an authorized overage', () => {
  const approved = { ...trip, authorizedItems: [{ id: 'marriott', category: 'lodging', label: 'Lodging — Marriott San Diego', merchant: 'Marriott', location: 'San Diego, CA', amount: 570, startDate: '2026-10-12', endDate: '2026-10-15' }] };
  const suggestion = suggestAssignment(approved, { merchant: 'Marriott San Diego', location: 'San Diego, CA', date: '2026-10-15', serviceStartDate: '2026-10-12', serviceEndDate: '2026-10-15', amount: 621, category: 'lodging' });
  assert.equal(suggestion.authorizationItemId, 'marriott');
  assert.equal(suggestion.confidence, 'high');
  assert.ok(suggestion.signals.includes('stay dates'));
});

test('rental receipt matches a unique authorized rental item', () => {
  const suggestion = suggestAssignment(trip, { merchant: 'Hertz', date: trip.startDate, amount: 284, category: 'rental_car' });
  assert.equal(suggestion.authorizationItemId, 'rental');
  assert.equal(suggestion.confidence, 'high');
});

test('two equal category matches remain unassigned', () => {
  const suggestion = suggestAssignment(trip, { merchant: '', date: '', amount: null, category: 'airfare' });
  assert.equal(suggestion.authorizationItemId, '');
  assert.equal(suggestion.confidence, 'review');
});

test('a second receipt cannot silently replace one already attached', () => {
  const suggestion = suggestAssignment(trip, { merchant: 'American Airlines', date: '2026-09-15', amount: 380, category: 'airfare' }, 'outbound flight', seedExpenses);
  assert.equal(suggestion.existingExpenseId, '');
});
