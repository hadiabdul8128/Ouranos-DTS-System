import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText } from '../src/receiptParser.js';

test('paid total wins over subtotal, tax, and a zero balance', () => {
  const parsed = parseReceiptText(`Marriott San Diego
123 Harbor Ave
San Diego, CA 92101
Check-in 10/12/2026
Check-out 10/15/2026
Date 10/15/2026
Subtotal $570.00
Occupancy Tax $51.00
Total $621.00
Amount Paid $621.00
Balance Due $0.00
Government Travel Card`);
  assert.equal(parsed.fields.merchant, 'Marriott San Diego');
  assert.equal(parsed.fields.date, '2026-10-15');
  assert.equal(parsed.fields.serviceStartDate, '2026-10-12');
  assert.equal(parsed.fields.serviceEndDate, '2026-10-15');
  assert.equal(parsed.fields.amount, 621);
  assert.equal(parsed.fields.taxes, 51);
  assert.equal(parsed.fields.subtotal, 570);
  assert.equal(parsed.fields.address, '123 Harbor Ave');
  assert.equal(parsed.fields.location, 'San Diego, CA 92101');
  assert.equal(parsed.fields.paymentMethod, 'gtcc');
  assert.equal(parsed.confidence.amount, 'high');
});

test('unlabeled or conflicting monetary values require review', () => {
  const unlabeled = parseReceiptText('Garage\n$25.00\n$27.00');
  assert.equal(unlabeled.fields.amount, null);
  assert.equal(unlabeled.confidence.amount, 'low');
  assert.deepEqual(unlabeled.candidates.amounts, [25, 27]);
  const conflicting = parseReceiptText('Garage\nTotal $25.00\nTotal $27.00');
  assert.equal(conflicting.fields.amount, null);
  assert.equal(conflicting.confidence.amount, 'low');
});

test('one unlabeled amount is a reviewable suggestion', () => {
  const parsed = parseReceiptText('Shell\n10/12/2026\n$31.42');
  assert.equal(parsed.fields.amount, 31.42);
  assert.equal(parsed.confidence.amount, 'medium');
  assert.equal(parsed.fields.category, 'fuel');
  assert.equal(parsed.fields.paymentMethod, '');
});

test('day-month dates and an explicit service fee are extracted', () => {
  const parsed = parseReceiptText('Airport Shuttle\nDate 14 Oct 2026\nFare $17.50\nService Fee $2.50\nTotal $20.00');
  assert.equal(parsed.fields.date, '2026-10-14');
  assert.equal(parsed.fields.fees, 2.5);
  assert.equal(parsed.fields.amount, 20);
  assert.equal(parsed.confidence.fees, 'high');
});

test('labeled merchants are read and merchant context wins over incidental fee words', () => {
  const parsed = parseReceiptText('RECEIPT\nMerchant: Marriott San Diego\nDate 10/15/2026\nFuel surcharge $5.00\nTotal paid $121.00');
  assert.equal(parsed.fields.merchant, 'Marriott San Diego');
  assert.equal(parsed.confidence.merchant, 'high');
  assert.equal(parsed.fields.category, 'lodging');
  assert.equal(parsed.fields.amount, 121);
  assert.equal(parsed.fields.fees, 5);
});
