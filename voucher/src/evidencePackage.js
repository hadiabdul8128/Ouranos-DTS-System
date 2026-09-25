import { buildDtsChecklist } from './dtsChecklist.js';
import { formatDate } from './reconcile.js';
import { disclaimer } from './rules.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Printable evidence package: DTS checklist first, then every receipt in label order. Save as PDF from the print dialog. */
export function buildEvidenceHtml({ trip, expenses, perDiem, resolutions = {}, generatedAt = new Date().toISOString() }) {
  const travelerEntered = trip.entrySource === 'traveler';
  const { steps, receiptLabels } = buildDtsChecklist({ trip, expenses, perDiem, resolutions });
  const labeled = expenses.filter(expense => receiptLabels[expense.id]).sort((a, b) => Number(receiptLabels[a.id].slice(1)) - Number(receiptLabels[b.id].slice(1)));
  const receiptPage = expense => {
    const label = receiptLabels[expense.id];
    const statement = resolutions[`${expense.id}:receipt_missing`]?.value;
    const body = expense.receipt?.dataUrl && expense.receipt.type?.startsWith('image/')
      ? `<img src="${escapeHtml(expense.receipt.dataUrl)}" alt="Receipt ${escapeHtml(label)}">`
      : expense.receipt ? `<p class="note">PDF or text receipt “${escapeHtml(expense.receipt.name)}”. Upload the original file to DTS as ${escapeHtml(label)}.</p>`
        : `<pre>${escapeHtml(statement?.text || '')}</pre>`;
    const hash = expense.receipt?.sha256 ? `<p class="hash">SHA-256 ${escapeHtml(expense.receipt.sha256)} · captured ${escapeHtml(new Date(expense.receipt.capturedAt).toLocaleString())}</p>` : '';
    return `<section class="page"><h2>${escapeHtml(label)} · ${escapeHtml(expense.merchant)} · $${Number(expense.amount).toFixed(2)}</h2><p class="meta">${escapeHtml(formatDate(expense.date))} · ${escapeHtml(expense.category.replaceAll('_', ' '))} · ${expense.paymentMethod === 'gtcc' ? 'GTCC' : 'Personal'}</p>${body}${hash}</section>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Voucher package · ${escapeHtml(trip.authorizationId)}</title><style>
    body{font:13px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif;color:#1d2b27;margin:32px;max-width:820px}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px}.meta,.note,.hash{color:#5a6b64}.hash{font:10px ui-monospace,monospace;word-break:break-all}
    ol{padding-left:20px}li{margin:4px 0}.warn{color:#8a5316}.src{display:block;color:#7a8a83;font-size:11px}.ev{color:#2b6a52;font-weight:600}
    .disclaimer{border:1px solid #d7e2dc;border-radius:8px;padding:10px 12px;color:#4f625a;font-size:12px}
    img{max-width:100%;max-height:900px;border:1px solid #ddd}pre{white-space:pre-wrap;border:1px solid #ddd;padding:14px;font:12px ui-monospace,monospace}
    .page{break-before:page}@media print{body{margin:0}}
  </style></head><body>
    <h1>Voucher package · ${escapeHtml(trip.destination)}</h1>
    <p class="meta">${escapeHtml(trip.traveler)} · ${travelerEntered ? 'Traveler-entered reference' : 'Authorization'} ${escapeHtml(trip.authorizationId)} · ${escapeHtml(formatDate(trip.startDate))}–${escapeHtml(formatDate(trip.endDate))} · generated ${escapeHtml(new Date(generatedAt).toLocaleString())}</p>
    ${travelerEntered ? '<p class="disclaimer">Trip and expense estimates were entered by the traveler. Ouranos has not verified authorization approval or approved amounts. Compare this package with the approved DTS authorization before review.</p>' : ''}
    <p class="disclaimer">${escapeHtml(disclaimer)} This is a checklist for entering your voucher in DTS. It is not a DTS submission.</p>
    ${steps.map((step, index) => `<h2>${index + 1}. ${escapeHtml(step.title)}</h2><ol>${step.items.map(item => `<li class="${item.warning ? 'warn' : ''}">${escapeHtml(item.text)}${item.evidence ? ` <span class="ev">[${escapeHtml(item.evidence)}]</span>` : ''}${item.rule ? ` <span class="src">${escapeHtml(item.rule)}</span>` : ''}${item.source ? `<span class="src">${escapeHtml(item.source)}</span>` : ''}</li>`).join('')}</ol>`).join('')}
    ${labeled.map(receiptPage).join('')}
  </body></html>`;
}
