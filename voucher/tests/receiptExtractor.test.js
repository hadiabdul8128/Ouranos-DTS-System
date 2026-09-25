import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReceipt } from '../src/receipt.js';
import { localReceiptExtractor } from '../src/receiptExtractor.js';

test('local extractor returns OCR text and structured fields separately', async () => {
  const file = { name: 'parking.txt', type: 'text/plain', text: async () => 'Union Station Parking\nDate 10/13/2026\nSubtotal $70.00\nTax $5.00\nTotal paid $75.00' };
  const extraction = await extractReceipt(file);
  assert.equal(extraction.rawText, await file.text());
  assert.equal(extraction.fields.merchant, 'Union Station Parking');
  assert.equal(extraction.fields.amount, 75);
  assert.equal(extraction.fields.taxes, 5);
  assert.equal(extraction.confidence.amount, 'high');
});

test('an alternate extractor can be injected without changing the Voucher reader', async () => {
  const provider = { extract: async () => ({ rawText: 'Provider text', fields: { merchant: 'Hertz', amount: 280 }, confidence: { merchant: 'high', amount: 'medium' } }) };
  assert.equal((await extractReceipt({}, provider)).fields.merchant, 'Hertz');
  await assert.rejects(extractReceipt({}, { extract: async () => ({ fields: {} }) }), /invalid result/);
  assert.equal(typeof localReceiptExtractor.extract, 'function');
});
