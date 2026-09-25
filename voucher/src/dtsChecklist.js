import { categoryLabels } from './data.js';
import { analyzeLodging } from './lodging.js';
import { formatDate } from './reconcile.js';
import { rules } from './rules.js';

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const money = amount => `$${Number(amount).toFixed(2)}`;

/**
 * Where each Ouranos category goes on the DTS Enter Expenses screen. Only group names confirmed in
 * DTMO's Aug 2025 category announcement are marked verified; the rest must be confirmed in DTS.
 */
export const dtsCategoryMap = {
  lodging: { group: 'Lodging Expenses', verified: true },
  airfare: { group: null, verified: false, note: 'If the flight was booked in DTS, it is already on the voucher. Do not enter it again.' },
  rental_car: { group: null, verified: false },
  fuel: { group: null, verified: false },
  parking: { group: null, verified: false },
  ground_transport: { group: null, verified: false },
  baggage: { group: null, verified: false },
  meals: { group: null, verified: false, note: 'M&IE is computed from per diem. Do not enter meals as an expense.' },
  other: { group: null, verified: false }
};

/** Screen-by-screen checklist with the numbers in the order DTS asks for them. */
export function buildDtsChecklist({ trip, expenses, perDiem, resolutions = {} }) {
  const receipted = expenses.filter(expense => expense.receipt || resolutions[`${expense.id}:receipt_missing`]?.type === 'lost_receipt_statement');
  const receiptLabels = Object.fromEntries(receipted.map((expense, index) => [expense.id, `R${index + 1}`]));
  const evidence = expense => receiptLabels[expense.id]
    ? `${receiptLabels[expense.id]}${expense.receipt ? '' : ' (lost-receipt statement)'}`
    : 'no receipt';
  const steps = [];

  if (perDiem?.days?.length) {
    steps.push({
      title: 'Per diem entitlements',
      items: [
        { text: `Check the locality is ${perDiem.locality?.name || trip.destination} and the rates match the table below.` },
        ...perDiem.days.map(day => ({
          text: `${formatDate(day.date)}: lodging cap ${day.lodgingCap == null ? 'none (return day)' : money(day.lodgingCap)}, M&IE ${money(day.mie)}${day.travelDay ? ' (travel day, 75%)' : ''}${day.provided?.length ? `. Mark ${day.provided.join(', ')} as provided.` : ''}`,
          source: day.source
        })),
        ...perDiem.warnings.map(warning => ({ text: warning, warning: true }))
      ]
    });
  }

  const lodging = expenses.filter(expense => expense.category === 'lodging');
  if (lodging.length) {
    steps.push({
      title: 'Lodging',
      items: lodging.flatMap(expense => {
        const split = analyzeLodging(expense, perDiem);
        const lines = [{ text: `${expense.merchant}: room cost ${money(split.room)}${split.nights ? ` for ${split.nights} nights (${money(split.nightly)}/night)` : ''}. Enter it under Lodging Expenses, excluding tax.`, amount: split.room, evidence: evidence(expense) }];
        if (split.tax > 0) lines.push({ text: `Lodging tax ${money(split.tax)} goes on its own line, not in the room rate.`, amount: split.tax, rule: rules.lodgingTax.cite, evidence: evidence(expense) });
        if (split.fees > 0) lines.push({ text: `Hotel fees of ${money(split.fees)} need their own line, if allowed.`, amount: split.fees, evidence: evidence(expense) });
        return lines;
      })
    });
  }

  const others = expenses.filter(expense => !['lodging', 'meals'].includes(expense.category));
  if (others.length) {
    steps.push({
      title: 'Other expenses',
      items: others.map(expense => {
        const map = dtsCategoryMap[expense.category] || dtsCategoryMap.other;
        return {
          text: `${formatDate(expense.date)} · ${expense.merchant} · ${money(expense.amount)} · ${expense.paymentMethod === 'gtcc' ? 'GTCC' : 'Personal'} · ${map.group ? `DTS: ${map.group}` : `choose the matching ${categoryLabels[expense.category] || 'expense'} item on Enter Expenses`}${map.note ? `. ${map.note}` : ''}`,
          amount: expense.amount, evidence: evidence(expense)
        };
      })
    });
  }
  if (expenses.some(expense => expense.category === 'meals')) {
    steps.push({ title: 'Meals', items: [{ text: dtsCategoryMap.meals.note }] });
  }

  const notes = Object.entries(resolutions).filter(([, value]) => value?.type === 'explanation');
  if (notes.length) {
    steps.push({
      title: 'Pre-audit justifications',
      items: notes.map(([id, value]) => ({ text: `${expenses.find(expense => expense.id === id.split(':')[0])?.merchant || 'Expense'}: “${value.value}”` }))
    });
  }

  const gtcc = round(expenses.filter(expense => expense.paymentMethod === 'gtcc' && expense.category !== 'meals').reduce((sum, expense) => sum + expense.amount, 0));
  steps.push({
    title: 'Method of reimbursement',
    items: [
      { text: `Split disbursement is mandatory for DoD travelers. Send at least ${money(gtcc)} to your GTCC (Citi) to cover the charges on this trip.`, amount: gtcc },
      { text: 'Any charge the split doesn’t cover is still yours to pay Citi by the statement due date.' }
    ]
  });
  steps.push({ title: 'Substantiating documents', items: receipted.map(expense => ({ text: `${receiptLabels[expense.id]}: ${expense.merchant}, ${formatDate(expense.date)}, ${money(expense.amount)}${expense.receipt ? '' : ' (lost-receipt statement)'}` })) });
  return { steps, receiptLabels, gtcc };
}
