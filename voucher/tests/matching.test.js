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
