import './style.css';
import { categoryLabels } from './data.js';
import { reconcile, formatDate } from './reconcile.js';
import { inferCategory, readReceipt } from './receipt.js';
import { normalizeAuthorization } from './authorization.js';
import { loadAuthorization } from './authorizationHandoff.js';
import { suggestAssignment } from './matching.js';
import { buildConfirmation } from './confirmation.js';
import { confirmScannedReceipt, prepareReceipt } from './receiptWorkflow.js';
import { computePerDiem } from './perDiem.js';
import { analyzeLodging } from './lodging.js';
import { assessReceipt } from './receiptValidity.js';
import { buildLostReceiptStatement } from './lostReceipt.js';
import { buildEvidenceHtml } from './evidencePackage.js';
import { encryptBackup, decryptBackup } from './backup.js';
import { buildManualAuthorization } from './tripSetup.js';
import { disclaimer } from './rules.js';

const storageKey = 'ouranos:voucher:v3';
const showDeveloperImport = import.meta.env.DEV || new URLSearchParams(location.search).has('dev');
const initial = () => ({ trip: null, source: null, intakeComplete: false, expenses: [], resolutions: {}, audit: [], pending: null, tripDetails: { mealsProvided: {}, governmentMess: false } });
let state;
try {
  const previous = JSON.parse(sessionStorage.getItem('ouranos:voucher:v2') || 'null');
  const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
  state = { ...initial(), ...(saved || (previous?.source !== 'sample' ? previous : null) || {}) };
  if (!saved && previous?.source !== 'sample' && previous) sessionStorage.setItem(storageKey, JSON.stringify(state));
}
catch { state = initial(); }
let trip = state.trip;
const app = document.querySelector('#app');
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const save = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { toast('Storage is full. The uploaded file may be too large.'); } };
const issueFor = (result, expense) => result.issues.filter(issue => issue.expenseId === expense.id);
const itemFor = expense => trip?.authorizedItems.find(item => item.id === expense.authorizationItemId);
const perDiemFor = () => trip ? computePerDiem({ startDate: trip.startDate, endDate: trip.endDate, destination: trip.destination, ...(state.tripDetails || {}) }) : null;
const footer = `<footer class="disclaimer-footer">${escapeHtml(disclaimer)}</footer>`;
const fileInputs = '<input id="new-file" type="file" accept="image/*,application/pdf,text/plain" hidden><input id="camera-file" type="file" accept="image/*" capture="environment" hidden><input id="attach-file" type="file" accept="image/*,application/pdf,text/plain" hidden><input id="authorization-file" type="file" accept="application/json,.json" hidden><input id="backup-file" type="file" accept="application/json,.json" hidden>';
let toastTimer;

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

function render() {
  if (!trip) return renderStart();
  const perDiem = perDiemFor();
  const result = reconcile(trip, state.expenses, state.resolutions, { intakeComplete: state.intakeComplete === true, perDiem });
  const count = result.issues.length;
  const started = state.expenses.length > 0;
  const readyForReview = result.ready && state.intakeComplete !== false;
  const receiptCount = state.expenses.filter(e => e.receipt).length;
  const matchedAutomatically = state.expenses.filter(expense => expense.receipt && expense.authorizationItemId && expense.assignmentSource === 'auto').length;
  app.innerHTML = `
    <header class="topbar"><div class="brand"><span class="brand-mark">O</span><span>OURANOS</span></div><span class="topbar-context">Travel voucher</span></header>
    <main class="shell">
      <div class="backline"><span>Travel</span><span class="chevron">›</span><strong>Finish my voucher</strong></div>
      <section class="trip-head">
        <div><div class="eyebrow">APPROVED TRIP · ${escapeHtml(trip.authorizationId)}</div><h1>Finish your ${escapeHtml(trip.destination)} trip</h1><p class="subhead">${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)} · ${formatDate(trip.startDate)}–${formatDate(trip.endDate)}</p></div>
        <div class="trip-actions"><div class="trip-status"><span class="status-dot"></span> Authorization approved</div>${showDeveloperImport ? '<button class="reset-link" data-action="load-authorization">Import another authorization JSON</button>' : ''}</div>
      </section>
      <section class="hero ${readyForReview ? 'hero-ready' : ''}" aria-live="polite">
        <div class="hero-icon">${readyForReview ? '✓' : !started ? '↑' : '!'}</div>
        <div class="hero-copy"><div class="eyebrow">${readyForReview ? 'VOUCHER READY' : !started ? 'START YOUR VOUCHER' : 'VOUCHER IN PROGRESS'}</div><h2>${!started ? 'Scan your first receipt' : count ? `${count} ${count === 1 ? 'thing needs' : 'things need'} your attention` : readyForReview ? 'Ready for review' : 'Add any remaining receipts'}</h2><p>${!started ? 'Your approved trip is here. Upload or photograph a receipt and say what it was for.' : count ? 'The rest is organized. Resolve these items to finish your voucher.' : readyForReview ? 'All exceptions have been addressed. Your review package is ready.' : 'When every expense is in the ledger, mark intake complete.'}</p></div>
        <div class="hero-checks"><strong>${matchedAutomatically}</strong><span>receipts matched automatically</span></div>
      </section>
      <div class="content-grid">
        <div class="main-column">
          <section class="section" id="attention"><div class="section-title"><div><div class="eyebrow">STEP 1</div><h2>${count ? 'Needs your attention' : started ? 'All caught up' : 'Your approved trip is ready'}</h2></div><span class="count-pill">${count}</span></div>
            ${count ? `<div class="issues">${result.issues.map((issue, index) => issueCard(issue, index)).join('')}</div>` : `<div class="empty-state"><span>${started ? '✓' : '↑'}</span><div><strong>${started ? 'No open exceptions' : 'Add a receipt to begin'}</strong><p>${!started ? 'We will extract the details and suggest where it belongs.' : readyForReview ? 'You can review the ledger or download the voucher package.' : 'Keep adding receipts, then mark expense intake complete.'}</p></div></div>`}
          </section>
          <section class="section" id="expenses"><div class="section-title"><div><div class="eyebrow">STEP 2</div><h2>Expenses</h2></div><span class="muted">${state.expenses.length} items · ${receiptCount} receipts</span></div>
            <div class="action-row"><button class="button button-primary" data-action="upload-new">↑ &nbsp;Upload receipt</button><button class="button button-secondary" data-action="camera">▣ &nbsp;Take a photo</button><button class="button button-secondary" data-action="add">＋ &nbsp;Add expense</button>${started && state.intakeComplete === false ? '<button class="button button-secondary" data-action="intake-complete">✓ &nbsp;Done adding expenses</button>' : ''}</div>
            ${state.pending ? state.pending.extracted && !state.pending.editing ? confirmationCard() : expenseForm() : ''}
            <div class="ledger"><div class="ledger-head"><span>EXPENSE</span><span>AUTHORIZED</span><span>ACTUAL</span><span>STATUS</span></div>${state.expenses.map(expense => expenseRow(expense, result, perDiem)).join('')}</div>
          </section>
        </div>
        <aside class="side-column"><section class="summary-card"><div class="eyebrow">VOUCHER SUMMARY</div><h2>${!started ? 'Not started' : count || !readyForReview ? 'Almost there' : 'Ready for review'}</h2><div class="summary-line"><span>Authorized</span><strong>${currency(result.totals.authorized)}</strong></div><div class="summary-line"><span>Actual expenses</span><strong>${currency(result.totals.actual)}</strong></div>${perDiem?.supported ? `<div class="summary-line"><span>M&IE allowance (per diem)</span><strong>${currency(perDiem.totals.mie)}</strong></div>` : ''}<div class="summary-line"><span>Receipts matched automatically</span><strong>${matchedAutomatically}</strong></div><div class="summary-divider"></div><div class="summary-line"><span>Paid with GTCC</span><strong>${currency(result.totals.gtcc)}</strong></div><div class="summary-line"><span>Paid personally</span><strong>${currency(result.totals.traveler)}</strong></div><div class="summary-divider"></div><div class="summary-line"><span>Required receipts</span><strong>${!started ? 'Not started' : result.issues.some(x => x.code === 'receipt_missing') ? 'Incomplete' : 'Complete'}</strong></div><div class="summary-line"><span>Open exceptions</span><strong>${count}</strong></div><button class="button button-primary export-button" data-action="evidence" ${!readyForReview ? 'disabled title="Finish expense intake and resolve all exceptions first"' : ''}>Open DTS checklist + receipts ↗</button><button class="button button-secondary export-button" data-action="export" ${!readyForReview ? 'disabled title="Finish expense intake and resolve all exceptions first"' : ''}>Download review data (JSON) ↓</button><p class="summary-note">Amounts are organized for review. Final reimbursement and policy decisions happen in the approved workflow.</p></section>
          ${perDiemCard(perDiem)}
          ${dataCard()}
          <section class="audit-card"><div class="eyebrow">AUDIT TRAIL</div><h3>What changed</h3>${state.audit.length ? `<ol>${state.audit.slice(-4).reverse().map(entry => `<li><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(new Date(entry.at).toLocaleString())}</span></li>`).join('')}</ol>` : '<p>No changes yet. Decisions and corrections will appear here.</p>'}</section>
        </aside>
      </div>
    ${footer}</main><div id="toast" class="toast" hidden></div>
    ${fileInputs}
  `;
  bindEvents();
}

function renderStart() {
  app.innerHTML = `
    <header class="topbar"><div class="brand"><span class="brand-mark">O</span><span>OURANOS</span></div><span class="topbar-context">Travel voucher</span></header>
    <main class="shell start-shell">
      <div class="backline"><span>Travel</span><span class="chevron">›</span><strong>Finish my voucher</strong></div>
      <section class="start-head"><div class="eyebrow">TRAVEL VOUCHER</div><h1>Scan a receipt to get started</h1><p>We’ll read the details. Tell us what it was for, then check and save it.</p></section>
      <div class="start-actions"><button class="button button-primary" data-action="upload-new">↑ &nbsp;Upload receipt</button><button class="button button-secondary" data-action="camera">▣ &nbsp;Take a photo</button><button class="button button-secondary" data-action="add">＋ &nbsp;Add expense</button></div>
      ${state.pending ? state.pending.extracted && !state.pending.editing ? confirmationCard() : expenseForm() : ''}
      ${state.expenses.length ? `<section class="section"><div class="section-title"><div><div class="eyebrow">SAVED LOCALLY</div><h2>Expenses waiting for a trip</h2></div><span class="muted">${state.expenses.length} items</span></div><div class="staged-list">${state.expenses.map(expense => `<div class="staged-row"><div><strong>${escapeHtml(expense.merchant)}</strong><small>${escapeHtml(formatDate(expense.date))} · ${escapeHtml(expense.purpose)} · ${expense.receipt ? 'Receipt attached' : 'No receipt'}</small></div><strong>${currency(expense.amount)}</strong><button class="row-edit" data-action="edit" data-expense="${escapeHtml(expense.id)}" aria-label="Edit ${escapeHtml(expense.merchant)}">⋯</button></div>`).join('')}</div></section>` : ''}
      <section class="authorization-start"><div><div class="eyebrow">APPROVED AUTHORIZATION</div><h2>Bring in your trip when it’s ready</h2><p>Your approved trip will appear here automatically. You can scan receipts while you wait, or enter the trip from your approved DTS authorization below.</p></div>${showDeveloperImport ? '<div class="authorization-actions"><button class="button button-secondary" data-action="load-authorization">Import authorization JSON for testing</button></div>' : ''}</section>
      ${tripSetupForm()}
      ${dataCard()}
    ${footer}</main><div id="toast" class="toast" hidden></div>
    ${fileInputs}`;
  bindEvents();
}

function issueCard(issue, index) {
  const expense = state.expenses.find(e => e.id === issue.expenseId);
  const unusedItem = issue.code === 'authorized_item_unaccounted' ? trip.authorizedItems.find(item => item.id === issue.authorizationItemId) : null;
  const isExplanation = issue.code === 'over_authorization' || issue.code === 'lodging_over_cap';
  const isReceipt = issue.code === 'receipt_missing';
  const isDate = issue.code === 'itinerary_changed';
  const isInvalidReceipt = issue.code === 'receipt_not_itemized';
  const isEditable = !isExplanation && !isReceipt && !isDate && !isInvalidReceipt;
  return `<article class="issue-card"><div class="issue-number">${index + 1}</div><div class="issue-body"><div class="issue-top"><strong>${escapeHtml(unusedItem?.label || expense?.merchant || 'Expense')}</strong><span>${escapeHtml(currency(unusedItem?.amount ?? expense?.amount ?? 0))}</span></div><p>${escapeHtml(issue.message)}${issue.rule ? ` <span class="rule-chip">${escapeHtml(issue.rule)}</span>` : ''}</p>${isExplanation ? `<form class="issue-form" data-resolution="${escapeHtml(issue.id)}"><label for="note-${index}">What caused the difference?</label><div class="inline-form"><input id="note-${index}" name="explanation" required minlength="8" placeholder="e.g. Conference rate was unavailable" value="${escapeHtml(expense?.explanation || '')}"><button class="button button-small" type="submit">Save explanation</button></div></form>` : ''}${isReceipt ? `<div class="issue-actions"><button class="button button-small" data-action="attach" data-expense="${escapeHtml(issue.expenseId)}">↑ &nbsp;Upload receipt</button></div><form class="issue-form lost-form" data-lost="${escapeHtml(issue.id)}"><label for="lost-${index}">Receipt lost? Write a lost-receipt statement instead</label><div class="inline-form"><input id="lost-${index}" name="reason" required minlength="8" placeholder="How was it lost? e.g. Pay station printer jammed"><button class="button button-small" type="submit">Create statement</button></div></form>` : ''}${isInvalidReceipt ? `<div class="issue-actions"><button class="button button-small" data-action="attach" data-expense="${escapeHtml(issue.expenseId)}">↑ &nbsp;Upload itemized receipt</button><button class="button button-small" data-action="confirm-valid" data-issue="${escapeHtml(issue.id)}">It is itemized</button></div>` : ''}${isDate ? `<button class="button button-small" data-action="confirm-date" data-issue="${escapeHtml(issue.id)}">Confirm ${escapeHtml(formatDate(issue.actualDate))}</button>` : ''}${unusedItem ? `<button class="button button-small" data-action="confirm-unused" data-issue="${escapeHtml(issue.id)}" data-item="${escapeHtml(unusedItem.id)}">Confirm not used</button>` : ''}${isEditable && !unusedItem ? `<button class="button button-small" data-action="edit" data-expense="${escapeHtml(issue.expenseId)}">${escapeHtml(issue.action)}</button>` : ''}</div></article>`;
}

function expenseRow(expense, result, perDiem) {
  const issues = issueFor(result, expense);
  const item = itemFor(expense);
  const lodging = analyzeLodging(expense, perDiem);
  const statement = state.resolutions[`${expense.id}:receipt_missing`]?.type === 'lost_receipt_statement';
  const status = issues.length ? 'Needs attention' : Object.keys(state.resolutions).some(key => key.startsWith(`${expense.id}:`)) ? 'Resolved' : 'Matched';
  return `<div class="ledger-row"><div class="ledger-expense"><span class="category-icon">${({ airfare: '✈', lodging: '▤', rental_car: '▣', fuel: '◈', meals: '◉', parking: 'Ⓟ', ground_transport: '↗', baggage: '▢' })[expense.category] || '•'}</span><div><strong>${escapeHtml(expense.merchant)}</strong><small>${escapeHtml(formatDate(expense.date))} · ${escapeHtml(categoryLabels[expense.category] || expense.category)} · ${expense.paymentMethod === 'gtcc' ? 'GTCC' : expense.paymentMethod === 'personal' ? 'Personal' : 'Payment needed'}${expense.receipt ? ' · Receipt' : statement ? ' · Lost-receipt statement' : ''}</small>${lodging?.tax > 0 ? `<small class="split-note">Room ${currency(lodging.room)} + tax ${currency(lodging.tax)} (separate DTS line)</small>` : ''}</div></div><span class="money-muted">${item ? currency(item.amount) : '—'}</span><strong class="amount">${currency(expense.amount)}</strong><span class="ledger-status ${issues.length ? 'status-warning' : 'status-ok'}">${status}</span><button class="row-edit" data-action="edit" data-expense="${escapeHtml(expense.id)}" aria-label="Edit ${escapeHtml(expense.merchant)}">⋯</button></div>`;
}

function confirmationCard() {
  const { expense, receipt, extraction, suggestion, existingExpenseId } = state.pending;
  const preview = buildConfirmation(trip, { ...expense, receipt }, state.expenses, existingExpenseId);
  const shown = preview.existing || expense;
  const amount = Number(shown.amount);
  const dates = shown.serviceStartDate && shown.serviceEndDate ? `${formatDate(shown.serviceStartDate)}–${formatDate(shown.serviceEndDate)}` : formatDate(shown.date);
  const overage = preview.issues.find(issue => issue.code === 'over_authorization');
  const otherIssues = preview.issues.filter(issue => issue.code !== 'over_authorization').slice(0, 2);
  const amountCandidates = extraction?.candidates?.amounts || [];
  const totalNote = extraction?.confidence?.amount === 'medium' ? '<span class="field-check">Check total</span>' : !Number.isFinite(amount) || amount <= 0 ? `<span class="field-check">Total needs confirmation${amountCandidates.length ? ` · OCR saw ${amountCandidates.map(currency).join(', ')}` : ''}</span>` : '';
  return `<section class="scan-confirm" aria-label="Confirm scanned receipt">
    <div class="form-heading"><div><strong>${preview.canConfirm ? 'Confirm this receipt' : 'A few details need your help'}</strong><p>Review the result, then confirm it or edit the details.</p></div><button type="button" class="plain-button" data-action="cancel" aria-label="Close scan">×</button></div>
    <label class="scan-hint">What was this for? <span>Optional</span><input id="scan-purpose" name="purpose" value="${escapeHtml(expense.purpose || '')}" placeholder="hotel, parking, rental car gas, taxi…"></label>
    <div class="scan-facts"><div><span>Merchant</span><strong>${escapeHtml(shown.merchant || 'Needs merchant')}</strong>${!shown.merchant ? '<small class="field-check">Not clear on receipt</small>' : ''}</div><div><span>Category</span><strong>${escapeHtml(categoryLabels[expense.category] || 'Other')}</strong>${expense.category === 'other' ? '<small class="field-check">Add a hint or choose in Edit</small>' : ''}</div><div><span>Date</span><strong>${escapeHtml(dates)}</strong>${!shown.date ? '<small class="field-check">Needs date</small>' : ''}</div><div><span>Paid total</span><strong>${Number.isFinite(amount) && amount > 0 ? currency(amount) : 'Needs total'}</strong>${totalNote}</div></div>
    <p class="scan-breakdown">${[expense.paymentMethod === 'gtcc' ? 'GTCC' : expense.paymentMethod === 'personal' ? 'Personal payment' : '<span class="field-check">Payment method needs confirmation</span>', extraction?.confidence?.currency === 'low' ? '<span class="field-check">Check currency (USD assumed)</span>' : escapeHtml(expense.currency || 'USD'), expense.taxes != null ? `Tax ${currency(expense.taxes)}` : '', expense.fees != null ? `Fees ${currency(expense.fees)}` : '', expense.tip != null ? `Tip ${currency(expense.tip)}` : ''].filter(Boolean).join(' · ')}</p>
    <div class="scan-match">${preview.existing ? `Matches existing expense: <strong>${escapeHtml(preview.existing.merchant)} · ${currency(preview.existing.amount)}</strong>` : preview.item ? `Matched to: <strong>${escapeHtml(preview.item.label)} · Authorized ${currency(preview.item.amount)}</strong>` : trip ? '<strong>No clear authorized match yet</strong>' : '<strong>Ready to save until your authorization is available</strong>'}${suggestion?.confidence === 'medium' && preview.item ? '<span>Suggested match — confirm before saving</span>' : ''}</div>
    ${(extraction?.validity?.problems || []).filter(problem => !/vendor|transaction date|paid total/.test(problem)).map(problem => `<p class="scan-warning"><strong>Before you leave the counter:</strong> ${escapeHtml(problem)}</p>`).join('')}
    ${overage ? `<p class="scan-warning">${escapeHtml(overage.message)} Explanation required after confirmation.</p>` : ''}
    ${otherIssues.map(issue => `<p class="scan-warning">${escapeHtml(issue.message)}</p>`).join('')}
    ${preview.missing.length ? `<p class="scan-warning">Enter ${escapeHtml(preview.missing.join(', '))} in Edit before confirming.</p>` : ''}
    <div class="form-actions"><button class="button button-secondary" data-action="edit-scan">Edit details</button><button class="button button-primary" data-action="confirm-scan" ${preview.canConfirm ? '' : 'disabled'}>${preview.existing ? 'Attach receipt' : 'Confirm expense'}</button></div>
  </section>`;
}

function fieldLabel(name, label) {
  const confirmedByHint = name === 'category' && inferCategory(state.pending?.expense?.purpose) === state.pending?.expense?.category && state.pending?.expense?.category !== 'other';
  return `${label}${state.pending?.extraction?.confidence?.[name] === 'low' && !confirmedByHint ? ' <span class="field-check">Check</span>' : ''}`;
}

function expenseForm() {
  const { expense = {}, receipt, extracted = false, existingExpenseId = '', suggestion } = state.pending;
  const options = (trip?.authorizedItems || []).map(item => `<option value="${escapeHtml(item.id)}" ${expense.authorizationItemId === item.id ? 'selected' : ''}>${escapeHtml(item.label)} · ${currency(item.amount)}</option>`).join('');
  const existingOptions = state.expenses.filter(item => !item.receipt || item.id === existingExpenseId).map(item => `<option value="${escapeHtml(item.id)}" ${existingExpenseId === item.id ? 'selected' : ''}>${escapeHtml(item.merchant)} · ${currency(item.amount)} · ${formatDate(item.date)}</option>`).join('');
  const needsDetails = !expense.merchant || !expense.date || !(Number(expense.amount) > 0) || expense.category === 'other';
  return `<form id="expense-form" class="expense-form">
    <div class="form-heading"><div><strong>${expense.id ? 'Edit expense' : extracted ? 'Receipt scanned' : 'Add expense'}</strong><p>${extracted ? 'Tell us what this was for. We filled what we could from the receipt.' : 'Enter what happened on your trip.'}</p></div><button type="button" class="plain-button" data-action="cancel" aria-label="Close form">×</button></div>
    <label class="purpose-label">What was this for? <span class="optional-label">Optional</span><input name="purpose" value="${escapeHtml(expense.purpose || '')}" placeholder="e.g. Parking at the conference"></label>
    ${extracted ? `<div class="match-box"><strong>Suggested placement</strong><p id="match-reason">${escapeHtml(suggestion?.reason || (trip ? 'Choose the approved item before saving.' : 'Load an approved authorization to allocate this expense.'))}</p><label>Match receipt to<select name="existingExpenseId"><option value="">Create a new expense</option>${existingOptions}</select></label></div>` : ''}
    <details class="receipt-details" ${!extracted || needsDetails ? 'open' : ''}><summary>${extracted ? 'Review scanned details' : 'Expense details'}</summary><div class="form-grid">
      <label>${fieldLabel('merchant', 'Merchant')}<input name="merchant" value="${escapeHtml(expense.merchant || '')}" placeholder="Merchant name"></label>
      <label>${fieldLabel('date', 'Date')}<input name="date" type="date" value="${escapeHtml(expense.date || '')}"></label>
      <label>${fieldLabel('amount', 'Paid total')}<input name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(expense.amount ?? '')}" placeholder="0.00"></label>
      <label>${fieldLabel('currency', 'Currency')}<select name="currency">${['USD', 'EUR', 'GBP', 'CAD'].map(code => `<option value="${code}" ${expense.currency === code ? 'selected' : ''}>${code}</option>`).join('')}</select></label>
      <label>${fieldLabel('category', 'Category')}<select name="category">${Object.entries(categoryLabels).map(([key, label]) => `<option value="${key}" ${expense.category === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>${fieldLabel('paymentMethod', 'Payment method')}<select name="paymentMethod"><option value="">Not found on receipt</option><option value="gtcc" ${expense.paymentMethod === 'gtcc' ? 'selected' : ''}>GTCC</option><option value="personal" ${expense.paymentMethod === 'personal' ? 'selected' : ''}>Personal</option></select></label>
      ${trip ? `<label>Authorized item<select name="authorizationItemId"><option value="">No match</option>${options}</select></label>` : ''}
      <div class="lodging-fields" data-lodging-fields ${expense.category === 'lodging' ? '' : 'hidden'}><label>Lodging check-in<input name="serviceStartDate" type="date" value="${escapeHtml(expense.serviceStartDate || '')}"></label><label>Lodging check-out<input name="serviceEndDate" type="date" value="${escapeHtml(expense.serviceEndDate || '')}"></label></div>
      <label>Location<input name="location" value="${escapeHtml(expense.location || '')}" placeholder="City, state"></label>
      <label>Address<input name="address" value="${escapeHtml(expense.address || '')}" placeholder="If shown on receipt"></label>
      <label>Tax<input name="taxes" type="number" min="0" step="0.01" value="${escapeHtml(expense.taxes ?? '')}" placeholder="Optional"></label>
      <label>Fees<input name="fees" type="number" min="0" step="0.01" value="${escapeHtml(expense.fees ?? '')}" placeholder="Optional"></label>
      <label>Notes<input name="notes" value="${escapeHtml(expense.notes || '')}" placeholder="Optional"></label>
    </div></details>${receipt || expense.receipt ? `<p class="attached">✓ Receipt attached: ${escapeHtml((receipt || expense.receipt).name)}</p>` : ''}<div class="form-actions">${expense.id ? `<button type="button" class="button button-secondary delete-expense" data-action="delete-expense" data-expense="${escapeHtml(expense.id)}">Delete expense</button>` : ''}<button type="button" class="button button-secondary" data-action="cancel">Cancel</button><button class="button button-primary" type="submit">${existingExpenseId ? 'Attach to expense' : 'Save expense'}</button></div>
  </form>`;
}

function perDiemCard(perDiem) {
  if (!perDiem) return '';
  const details = state.tripDetails || { mealsProvided: {} };
  const caps = [...new Set(perDiem.days.filter(day => day.lodgingCap != null).map(day => day.lodgingCap))];
  const mealRows = perDiem.days.filter(day => day.mieRate != null).map(day => `<div class="meal-row"><span>${escapeHtml(formatDate(day.date))}</span>${['breakfast', 'lunch', 'dinner'].map(meal => `<label><input type="checkbox" data-meal="${meal}" data-date="${day.date}" ${details.mealsProvided?.[day.date]?.[meal] ? 'checked' : ''}> ${meal[0].toUpperCase()}</label>`).join('')}<strong>${currency(day.mie)}</strong></div>`).join('');
  return `<section class="summary-card perdiem-card"><div class="eyebrow">PER DIEM · ${escapeHtml(perDiem.locality?.name || trip.destination)}</div>
    <h2>${perDiem.supported ? `${currency(perDiem.totals.mie)} for meals` : 'Check with your DTA'}</h2>
    ${perDiem.supported ? `<p class="plain-money">You get ${currency(perDiem.totals.mie)} in meals &amp; incidentals for this trip. That’s 75% on your travel days and the full rate on the days between${perDiem.days.some(day => day.provided.length) ? ', minus the meals you were given' : ''}. Lodging is covered up to ${caps.map(currency).join(' / ')} a night, before tax.</p>` : ''}
    ${perDiem.warnings.map(warning => `<p class="scan-warning">${escapeHtml(warning)}</p>`).join('')}
    ${mealRows ? `<details class="meal-details"><summary>Meals provided (conference, government)?</summary><p class="muted">Tick any meal you didn’t pay for. It comes off your M&amp;IE.</p>${mealRows}<label class="mess-toggle"><input type="checkbox" data-action-toggle="mess" ${details.governmentMess ? 'checked' : ''}> A Government mess was available</label></details>` : ''}
    <p class="summary-note">${escapeHtml(perDiem.days.find(day => day.source)?.source || '')}. Check against the DTMO per-diem lookup.</p></section>`;
}

function dataCard() {
  return `<section class="audit-card data-card"><div class="eyebrow">YOUR DATA</div><h3>Only on this device</h3><p>Nothing is uploaded. Closing this tab clears it, so save an encrypted backup you can restore later.</p><div class="data-actions"><button class="button button-small" data-action="backup">Save encrypted backup</button><button class="button button-small" data-action="restore">Restore backup</button><button class="reset-link" data-action="delete-all">Delete all data</button></div></section>`;
}

function tripSetupForm() {
  return `<form id="trip-setup" class="expense-form trip-setup"><div class="form-heading"><div><strong>Enter your approved trip</strong><p>Copy these from your approved DTS authorization. We don’t need a photo of your orders.</p></div></div><div class="form-grid">
    <label>Duty location (City, ST)<input name="destination" required placeholder="San Diego, CA"></label>
    <label>Traveling from<input name="origin" required placeholder="Fayetteville, NC"></label>
    <label>Departure date<input name="startDate" type="date" required></label>
    <label>Return date<input name="endDate" type="date" required></label>
    <label>Your name <span class="optional-label">Optional</span><input name="traveler" placeholder="As on the authorization"></label>
    <label>DTS document or authorization number <span class="optional-label">Optional</span><input name="authorizationId"></label>
    <label>Airfare estimate <span class="optional-label">If authorized</span><input name="airfare" type="number" min="0" step="0.01" placeholder="0.00"></label>
    <label>Rental car estimate <span class="optional-label">If authorized</span><input name="rentalCar" type="number" min="0" step="0.01" placeholder="0.00"></label>
    <label>Rental car fuel estimate <span class="optional-label">If authorized</span><input name="fuel" type="number" min="0" step="0.01" placeholder="0.00"></label>
    <label>Parking estimate <span class="optional-label">If authorized</span><input name="parking" type="number" min="0" step="0.01" placeholder="0.00"></label>
  </div><p class="summary-note">Lodging and M&amp;IE are filled in from the official per-diem rates for your location and dates.</p><div class="form-actions"><button class="button button-primary" type="submit">Start my voucher</button></div></form>`;
}

function bindEvents() {
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleAction));
  app.querySelectorAll('[data-resolution]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const id = form.dataset.resolution;
    const explanation = new FormData(form).get('explanation').trim();
    if (explanation.length < 8) return;
    const expense = state.expenses.find(e => e.id === id.split(':')[0]);
    expense.explanation = explanation;
    state.resolutions[id] = { type: 'explanation', value: explanation, at: new Date().toISOString() };
    log(`Explained ${expense.merchant} overage`); save(); render(); toast('Explanation saved.');
  }));
  app.querySelectorAll('[data-lost]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const id = form.dataset.lost;
    const expense = state.expenses.find(e => e.id === id.split(':')[0]);
    try {
      const statement = buildLostReceiptStatement(expense, { reason: new FormData(form).get('reason'), traveler: trip?.traveler });
      state.resolutions[id] = { type: 'lost_receipt_statement', value: statement, at: new Date().toISOString() };
      log(`Wrote lost-receipt statement for ${expense.merchant}`); save(); render(); toast('Statement added. Sign it when you print the package.');
    } catch (error) { toast(error.message); }
  }));
  app.querySelectorAll('[data-meal]').forEach(box => box.addEventListener('change', () => {
    const { date, meal } = box.dataset;
    state.tripDetails ||= { mealsProvided: {}, governmentMess: false };
    state.tripDetails.mealsProvided[date] = { ...(state.tripDetails.mealsProvided[date] || {}), [meal]: box.checked };
    log(`${box.checked ? 'Marked' : 'Unmarked'} ${meal} provided on ${formatDate(date)}`); save(); render();
    app.querySelector('.meal-details').open = true;
  }));
  app.querySelector('[data-action-toggle="mess"]')?.addEventListener('change', event => {
    state.tripDetails ||= { mealsProvided: {}, governmentMess: false };
    state.tripDetails.governmentMess = event.currentTarget.checked;
    save(); render();
  });
  app.querySelector('#trip-setup')?.addEventListener('submit', event => {
    event.preventDefault();
    try { applyAuthorization(buildManualAuthorization(Object.fromEntries(new FormData(event.currentTarget))).authorization, 'manual'); }
    catch (error) { toast(`Could not start the voucher: ${error.message}`); }
  });
  app.querySelector('#backup-file').addEventListener('change', event => restoreBackup(event.target.files[0]));
  app.querySelector('#expense-form')?.addEventListener('submit', saveExpense);
  app.querySelector('#scan-purpose')?.addEventListener('input', updateScanHint);
  app.querySelector('#expense-form [name="category"]')?.addEventListener('change', event => toggleCategoryFields(event.currentTarget.form));
  if (state.pending?.extracted) app.querySelector('#expense-form [name="purpose"]')?.addEventListener('input', updatePurposeSuggestion);
  app.querySelector('#new-file').addEventListener('change', event => processNewReceipt(event.target.files[0]));
  app.querySelector('#camera-file').addEventListener('change', event => processNewReceipt(event.target.files[0]));
  app.querySelector('#attach-file').addEventListener('change', event => attachReceipt(event.target.files[0], event.target.dataset.expense));
  app.querySelector('#authorization-file').addEventListener('change', event => importAuthorizationFile(event.target.files[0]));
}

function updatePurposeSuggestion(event) {
  const form = event.currentTarget.form;
  const pending = state.pending;
  const suggestion = suggestAssignment(trip, pending.expense, event.currentTarget.value, state.expenses);
  pending.suggestion = suggestion;
  form.elements.category.value = suggestion.category;
  toggleCategoryFields(form);
  if (form.elements.authorizationItemId) form.elements.authorizationItemId.value = suggestion.authorizationItemId;
  form.elements.existingExpenseId.value = suggestion.existingExpenseId;
  form.querySelector('#match-reason').textContent = suggestion.reason;
  form.querySelector('[type="submit"]').textContent = suggestion.existingExpenseId ? 'Attach to expense' : 'Save expense';
}

function updateScanHint(event) {
  const position = event.currentTarget.selectionStart;
  const purpose = event.currentTarget.value;
  const suggestion = suggestAssignment(trip, state.pending.extraction.fields, purpose, state.expenses);
  state.pending.suggestion = suggestion;
  state.pending.existingExpenseId = suggestion.existingExpenseId;
  state.pending.expense = { ...state.pending.expense, purpose, category: suggestion.category, authorizationItemId: suggestion.authorizationItemId };
  render();
  const input = app.querySelector('#scan-purpose');
  input.focus(); input.setSelectionRange(position, position);
}

function toggleCategoryFields(form) {
  form.querySelector('[data-lodging-fields]').hidden = form.elements.category.value !== 'lodging';
}

function log(label) { state.audit.push({ label, at: new Date().toISOString() }); }
function handleAction(event) {
  const { action, expense: expenseId, issue: issueId, item: itemId } = event.currentTarget.dataset;
  if (action === 'load-authorization') return app.querySelector('#authorization-file').click();
  if (action === 'upload-new') return app.querySelector('#new-file').click();
  if (action === 'camera') return app.querySelector('#camera-file').click();
  if (action === 'attach') { const input = app.querySelector('#attach-file'); input.dataset.expense = expenseId; return input.click(); }
  if (action === 'add') { state.pending = { expense: { date: trip?.endDate || '', currency: 'USD' } }; render(); return app.querySelector('#expense-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (action === 'edit') { const expense = structuredClone(state.expenses.find(e => e.id === expenseId)); state.pending = { expense, extraction: expense.extraction || null }; render(); return app.querySelector('#expense-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (action === 'edit-scan') { state.pending.editing = true; render(); return app.querySelector('#expense-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (action === 'confirm-scan') return confirmPendingReceipt();
  if (action === 'delete-expense' && confirm('Delete this expense and its attached receipt?')) { state.expenses = state.expenses.filter(expense => expense.id !== expenseId); state.pending = null; for (const key of Object.keys(state.resolutions)) if (key.startsWith(`${expenseId}:`)) delete state.resolutions[key]; state.intakeComplete = false; log('Deleted expense'); save(); render(); toast('Expense deleted.'); }
  if (action === 'cancel') { if (state.pending?.extracted && state.pending.editing) state.pending.editing = false; else state.pending = null; save(); render(); }
  if (action === 'confirm-date') { state.resolutions[issueId] = { type: 'confirmed_date', value: state.expenses.find(e => e.id === issueId.split(':')[0]).date, at: new Date().toISOString() }; log('Confirmed actual return date'); save(); render(); toast('Return date confirmed.'); }
  if (action === 'confirm-unused') { state.resolutions[issueId] = { type: 'not_used', value: itemId, at: new Date().toISOString() }; log(`Confirmed ${trip.authorizedItems.find(item => item.id === itemId)?.label || 'approved item'} was not used`); save(); render(); toast('Approved item marked unused.'); }
  if (action === 'export') exportPackage();
  if (action === 'evidence') openEvidencePackage();
  if (action === 'confirm-valid') { const expense = state.expenses.find(e => e.id === issueId.split(':')[0]); state.resolutions[issueId] = { type: 'confirmed_valid', value: expense.receipt?.name, at: new Date().toISOString() }; log(`Confirmed ${expense.merchant} receipt is itemized`); save(); render(); toast('Receipt confirmed.'); }
  if (action === 'backup') return saveBackup();
  if (action === 'restore') return app.querySelector('#backup-file').click();
  if (action === 'delete-all' && confirm('Delete this trip, every expense, and every receipt from this device? This cannot be undone.')) { sessionStorage.removeItem(storageKey); sessionStorage.removeItem('ouranos:voucher:v2'); state = initial(); trip = null; render(); toast('All voucher data deleted from this device.'); }
  if (action === 'intake-complete') { state.intakeComplete = true; log('Finished adding expenses'); save(); render(); toast('Expense intake complete.'); }
}

async function processNewReceipt(file) {
  if (!file) return;
  toast('Reading receipt…');
  try {
    const { extraction, receipt } = await readReceipt(file);
    state.pending = prepareReceipt(trip, extraction, receipt, state.expenses);
    save(); render(); app.querySelector('.scan-confirm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Receipt read. Confirm it or edit any uncertain details.');
  } catch (error) { toast(`Could not read receipt: ${error.message}`); }
}

async function attachReceipt(file, expenseId) {
  if (!file) return;
  try {
    const { receipt, extraction } = await readReceipt(file);
    const expense = state.expenses.find(e => e.id === expenseId);
    expense.receipt = receipt;
    expense.extraction = { ...extraction, validity: assessReceipt(extraction.rawText, { ...extraction.fields, merchant: extraction.fields.merchant || expense.merchant, category: expense.category }) };
    delete state.resolutions[`${expense.id}:receipt_not_itemized`];
    log(`Attached receipt to ${expense.merchant}`); save(); render(); toast('Receipt attached.');
  } catch (error) { toast(`Could not attach receipt: ${error.message}`); }
}

function saveExpense(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const values = {
    merchant: String(form.get('merchant') || '').trim(), date: String(form.get('date') || ''), amount: Number(form.get('amount')),
    currency: form.get('currency'), category: form.get('category'), paymentMethod: form.get('paymentMethod'),
    authorizationItemId: form.get('authorizationItemId') || '', existingExpenseId: form.get('existingExpenseId') || '',
    location: String(form.get('location') || '').trim(), address: String(form.get('address') || '').trim(), notes: String(form.get('notes') || '').trim(), purpose: String(form.get('purpose') || '').trim(),
    taxes: form.get('taxes') === '' ? null : Number(form.get('taxes')),
    fees: form.get('fees') === '' ? null : Number(form.get('fees')),
    serviceStartDate: form.get('category') === 'lodging' ? form.get('serviceStartDate') || undefined : undefined,
    serviceEndDate: form.get('category') === 'lodging' ? form.get('serviceEndDate') || undefined : undefined
  };
  if (!commitExpense(values)) event.currentTarget.querySelector('.receipt-details').open = true;
}

function confirmPendingReceipt() {
  try {
    const result = confirmScannedReceipt(trip, state.expenses, state.pending, crypto.randomUUID());
    state.expenses = result.expenses;
    state.intakeComplete = false;
    for (const key of Object.keys(state.resolutions)) if (key.startsWith(`${result.expense.id}:`)) delete state.resolutions[key];
    log(`${result.attachedToExisting ? 'Attached receipt to' : 'Added'} ${result.expense.merchant}`);
    state.pending = null; save(); render(); toast(result.attachedToExisting ? 'Receipt attached to the existing expense.' : 'Expense saved.');
  } catch (error) { toast(error.message); }
}

function commitExpense(values) {
  const pending = state.pending;
  const old = pending.expense;
  if (values.existingExpenseId && pending.receipt) {
    const existing = state.expenses.find(expense => expense.id === values.existingExpenseId);
    if (!existing) { toast('That expense is no longer in the ledger. Choose another match.'); return false; }
    existing.receipt = pending.receipt;
    existing.extraction = pending.extraction;
    if (values.purpose) existing.purpose = values.purpose;
    log(`Matched scanned receipt to ${existing.merchant}`);
    state.pending = null; save(); render(); toast('Receipt attached to the existing expense.');
    return true;
  }
  const merchant = String(values.merchant || '').trim();
  const date = String(values.date || '');
  const amount = Number(values.amount);
  if (!merchant || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) {
    toast('Check the merchant, date, and paid total before saving.');
    return false;
  }
  const authorizationItemId = values.authorizationItemId || '';
  const autoAssigned = pending.extracted && authorizationItemId && authorizationItemId === pending.suggestion?.authorizationItemId && values.category === pending.suggestion?.category;
  const assignmentSource = autoAssigned ? 'auto' : old.authorizationItemId === authorizationItemId && old.assignmentSource ? old.assignmentSource : 'manual';
  const expense = {
    ...old, ...values, id: old.id || crypto.randomUUID(), tripId: trip?.id || null,
    merchant, date, amount, authorizationItemId,
    receipt: pending.receipt || old.receipt || null,
    extraction: pending.extraction || old.extraction || null,
    assignmentSource,
    matching: autoAssigned ? { confidence: pending.suggestion.confidence, score: pending.suggestion.score, signals: pending.suggestion.signals } : { confidence: 'manual', signals: [] }
  };
  delete expense.existingExpenseId;
  const index = state.expenses.findIndex(e => e.id === expense.id);
  if (index >= 0) state.expenses[index] = expense; else state.expenses.push(expense);
  state.intakeComplete = false;
  for (const key of Object.keys(state.resolutions)) if (key.startsWith(`${expense.id}:`)) delete state.resolutions[key];
  log(`${index >= 0 ? 'Updated' : 'Added'} ${expense.merchant}`); state.pending = null; save(); render(); toast('Expense saved.');
  return true;
}

function exportPackage() {
  const result = reconcile(trip, state.expenses, state.resolutions, { intakeComplete: state.intakeComplete === true, perDiem: perDiemFor() });
  if (!result.ready || state.intakeComplete === false) return;
  const payload = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: state.source, trip, expenses: state.expenses, reconciliation: result, resolutions: state.resolutions, audit: state.audit, notice: 'Review package only. Not a DTS submission or final reimbursement decision. Uploaded receipts are embedded as data URLs.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `ouranos-voucher-${trip.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  log('Downloaded review package'); save(); render();
}

function openEvidencePackage() {
  const perDiem = perDiemFor();
  const result = reconcile(trip, state.expenses, state.resolutions, { intakeComplete: state.intakeComplete === true, perDiem });
  if (!result.ready || state.intakeComplete === false) return;
  const html = buildEvidenceHtml({ trip, expenses: state.expenses, perDiem, resolutions: state.resolutions });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const opened = window.open(url, '_blank');
  if (!opened) { const link = document.createElement('a'); link.href = url; link.download = `ouranos-voucher-${trip.id}.html`; link.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  log('Opened DTS checklist and receipts'); save(); render(); toast('Use Print → Save as PDF to keep a copy.');
}

async function saveBackup() {
  const passphrase = prompt('Choose a passphrase for this backup (at least 10 characters). You will need it to restore. It is not stored anywhere.');
  if (passphrase == null) return;
  try {
    const file = await encryptBackup({ ...state, pending: null }, passphrase);
    const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `ouranos-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    log('Saved encrypted backup'); save(); render(); toast('Encrypted backup saved.');
  } catch (error) { toast(error.message); }
}

async function restoreBackup(file) {
  if (!file) return;
  const passphrase = prompt('Enter the backup passphrase.');
  if (passphrase == null) return;
  try {
    const restored = await decryptBackup(await file.text(), passphrase);
    if ((trip || state.expenses.length) && !confirm('Replace what is on this device with the backup?')) return;
    state = { ...initial(), ...restored, pending: null };
    trip = state.trip;
    log('Restored encrypted backup'); save(); render(); toast('Backup restored.');
  } catch (error) { toast(error.message); }
}

function applyAuthorization(input, source = 'imported') {
  const approved = normalizeAuthorization(input);
  const replaceTrip = Boolean(trip && trip.id !== approved.id && state.expenses.length && confirm('Replace this trip and its voucher expenses? Download the review package first if you need a copy.'));
  if (trip && trip.id !== approved.id && state.expenses.length && !replaceTrip) return;
  state = loadAuthorization(state, approved, { source, replaceTrip });
  trip = state.trip;
  save(); render(); toast(state.expenses.length ? 'Approved trip loaded. Saved expenses were matched to it.' : 'Approved trip loaded. Scan a receipt to begin.');
}

async function importAuthorizationFile(file) {
  if (!file) return;
  try { applyAuthorization(JSON.parse(await file.text())); }
  catch (error) { toast(`Could not load authorization: ${error.message}`); }
}

async function loadAuthorizationFromRoute() {
  const id = new URLSearchParams(location.search).get('authorizationId');
  if (!id || trip?.authorizationId === id) return;
  await loadAuthorizationById(id);
}

function loadAuthorizationFromSessionHandoff() {
  const key = 'ouranos:approved-authorization:v1';
  const raw = sessionStorage.getItem(key);
  if (!raw) return;
  sessionStorage.removeItem(key);
  try { applyAuthorization(JSON.parse(raw), 'handoff'); }
  catch (error) { toast(`Could not load authorization handoff: ${error.message}`); }
}

async function loadAuthorizationById(id) {
  if (!id) return;
  try {
    const response = await fetch(`/api/authorizations/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Authorization ${id} is not available yet. Import an approved authorization JSON file when you have one.`);
    const authorization = await response.json();
    if (normalizeAuthorization(authorization).authorizationId !== id) throw new Error('The returned authorization ID does not match the requested trip.');
    applyAuthorization(authorization, 'api');
  } catch (error) { toast(error.message); }
}

render();
loadAuthorizationFromSessionHandoff();
loadAuthorizationFromRoute();
window.addEventListener('ouranos:authorization-approved', event => {
  try { applyAuthorization(event.detail, 'handoff'); }
  catch (error) { toast(`Could not load authorization: ${error.message}`); }
});
