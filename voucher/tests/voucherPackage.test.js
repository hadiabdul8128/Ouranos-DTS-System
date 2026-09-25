import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthorization } from '../src/authorization.js';
import { buildManualAuthorization } from '../src/tripSetup.js';
import { buildDtsChecklist } from '../src/dtsChecklist.js';
import { buildEvidenceHtml } from '../src/evidencePackage.js';
import { encryptBackup, decryptBackup } from '../src/backup.js';
import { buildLostReceiptStatement } from '../src/lostReceipt.js';
import { reconcile } from '../src/reconcile.js';

const { authorization, perDiem } = buildManualAuthorization({ destination: 'San Diego, CA', origin: 'Fayetteville, NC', startDate: '2026-10-12', endDate: '2026-10-15', traveler: 'Alex Morgan', authorizationId: 'AUTH-77', airfare: '620', rentalCar: '' });
const trip = normalizeAuthorization(authorization);

test('manual setup builds a valid authorization from per-diem math, not guesses', () => {
  assert.deepEqual(trip.authorizedItems.map(item => [item.id, item.amount]), [['lodging', 624], ['mie', 301], ['airfare', 620]]);
  assert.equal(trip.authorizedItems[0].nights, 3);
  const unaccounted = reconcile(trip, [], {}, { intakeComplete: true, perDiem }).issues.map(issue => issue.authorizationItemId);
  assert.deepEqual(unaccounted, ['lodging', 'airfare'], 'M&IE is computed, so it never asks to be confirmed unused');
  assert.throws(() => buildManualAuthorization({ destination: 'San Diego, CA', startDate: '2026-10-15', endDate: '2026-10-12' }), /dates/);
  assert.throws(() => buildManualAuthorization({ destination: 'San Diego, CA', startDate: '2026-10-12', endDate: '2026-10-15', airfare: '-5' }), /positive/);
});

const expenses = [
  { id: 'h', merchant: 'Marriott', date: '2026-10-15', amount: 621, taxes: 51, category: 'lodging', paymentMethod: 'gtcc', serviceStartDate: '2026-10-12', serviceEndDate: '2026-10-15', receipt: { name: 'folio.jpg', type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AA==', sha256: 'ab'.repeat(32), capturedAt: '2026-10-15T15:00:00Z' } },
  { id: 'a', merchant: 'American Airlines', date: '2026-10-12', amount: 620, category: 'airfare', paymentMethod: 'gtcc', receipt: { name: 'eticket.pdf', type: 'application/pdf' } },
  { id: 'p', merchant: 'Harbor Parking', date: '2026-10-13', amount: 80, category: 'parking', paymentMethod: 'personal', receipt: null }
];
const statement = buildLostReceiptStatement(expenses[2], { reason: 'Pay station printer was jammed.', traveler: 'Alex Morgan' });
const resolutions = { 'p:receipt_missing': { type: 'lost_receipt_statement', value: statement }, 'h:over_authorization': { type: 'explanation', value: 'Conference hotel rate.' } };

test('DTS checklist splits lodging tax, labels evidence, and states split disbursement', () => {
  const { steps, receiptLabels, gtcc } = buildDtsChecklist({ trip, expenses, perDiem, resolutions });
  assert.deepEqual(steps.map(step => step.title), ['Per diem entitlements', 'Lodging', 'Other expenses', 'Pre-audit justifications', 'Method of reimbursement', 'Substantiating documents']);
  const lodging = steps[1].items;
  assert.match(lodging[0].text, /room cost \$570\.00 for 3 nights \(\$190\.00\/night\)/);
  assert.match(lodging[1].text, /Lodging tax \$51\.00 goes on its own line/);
  assert.deepEqual(receiptLabels, { h: 'R1', a: 'R2', p: 'R3' });
  assert.match(steps[2].items[0].text, /already on the voucher/);
  assert.equal(steps[2].items[1].evidence, 'R3 (lost-receipt statement)');
  assert.equal(gtcc, 1241);
  assert.match(steps[0].items[1].text, /M&IE \$64\.50 \(travel day, 75%\)/);
});

test('evidence package is escaped, ordered, and carries hashes and statements', () => {
  const html = buildEvidenceHtml({ trip: { ...trip, traveler: '<script>x</script>' }, expenses, perDiem, resolutions, generatedAt: '2026-10-16T12:00:00Z' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.indexOf('R1 · Marriott') < html.indexOf('R2 · American Airlines'));
  assert.match(html, /SHA-256 (ab){32}/);
  assert.match(html, /LOST RECEIPT STATEMENT/);
  assert.match(html, /Not affiliated with or endorsed by DoD/);
});

test('encrypted backup round-trips and rejects a wrong passphrase', async () => {
  const data = { trip, expenses, resolutions };
  const file = await encryptBackup(data, 'correct horse battery');
  assert.ok(!file.includes('Marriott'));
  assert.deepEqual(await decryptBackup(file, 'correct horse battery'), JSON.parse(JSON.stringify(data)));
  await assert.rejects(decryptBackup(file, 'wrong passphrase!!'), /Wrong passphrase/);
  await assert.rejects(encryptBackup(data, 'short'), /at least 10/);
});
