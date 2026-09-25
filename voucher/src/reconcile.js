import { rules } from './rules.js';
import { analyzeLodging } from './lodging.js';

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const money = amount => `$${amount.toFixed(2)}`;
const explained = candidate => candidate?.type === 'explanation' && String(candidate.value || '').trim().length >= 8;
/** Amount compared against the authorization: CONUS lodging tax is a separate reimbursable line. */
const authorizedBasis = expense => expense.category === 'lodging' && Number.isFinite(expense.taxes) && expense.taxes > 0 ? round(expense.amount - expense.taxes) : expense.amount;

export function reconcile(trip, expenses, resolutions = {}, options = {}) {
  const issues = [];
  const checks = [];
  const authorized = new Map(trip.authorizedItems.map(item => [item.id, item]));
  const grouped = new Map();
  for (const expense of expenses) {
    if (!expense.authorizationItemId) continue;
    const group = grouped.get(expense.authorizationItemId) || [];
    group.push(expense);
    grouped.set(expense.authorizationItemId, group);
  }

  if (options.intakeComplete) {
    for (const item of trip.authorizedItems) {
      if (grouped.has(item.id)) continue;
      // M&IE is a computed allowance, not a receipted expense, so there is nothing to "use".
      if (item.category === 'meals' && options.perDiem?.supported) continue;
      const id = `auth:${item.id}:not_used`;
      const resolution = resolutions[id];
      if (resolution?.type === 'not_used' && resolution.value === item.id) checks.push({ id, code: 'authorized_item_accounted', resolved: true, resolution });
      else issues.push({ id, code: 'authorized_item_unaccounted', authorizationItemId: item.id, message: `No actual expense was recorded for ${item.label}.`, action: 'Confirm not used' });
    }
  }
  const fingerprints = new Map();
  const add = (expense, code, message, action, detail = {}) => {
    const id = `${expense.id}:${code}`;
    const candidate = resolutions[id];
    const resolution = ['over_authorization', 'lodging_over_cap'].includes(code) && explained(candidate) ? candidate
      : code === 'itinerary_changed' && candidate?.type === 'confirmed_date' && candidate.value === expense.date ? candidate
        : code === 'receipt_missing' && candidate?.type === 'lost_receipt_statement' && candidate.value?.amount === expense.amount && candidate.value?.date === expense.date ? candidate
          : code === 'receipt_not_itemized' && candidate?.type === 'confirmed_valid' && candidate.value === expense.receipt?.name ? candidate
            : null;
    if (resolution) checks.push({ id, expenseId: expense.id, code, resolved: true, resolution });
    else issues.push({ id, expenseId: expense.id, code, message, action, ...detail });
  };

  for (const expense of expenses) {
    const item = authorized.get(expense.authorizationItemId);
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      add(expense, 'invalid_amount', 'Enter an amount greater than zero.', 'Edit expense');
    } else checks.push({ expenseId: expense.id, code: 'valid_amount' });

    if (expense.currency !== trip.currency) add(expense, 'currency', `Currency is ${expense.currency}; authorization is ${trip.currency}.`, 'Review currency');
    else checks.push({ expenseId: expense.id, code: 'currency' });

    if (!expense.paymentMethod || !['gtcc', 'personal'].includes(expense.paymentMethod)) add(expense, 'payment', 'Choose GTCC or personal payment.', 'Set payment method');
    else checks.push({ expenseId: expense.id, code: 'payment' });
    if (item?.expectedPaymentMethod && expense.paymentMethod && expense.paymentMethod !== item.expectedPaymentMethod) {
      add(expense, 'payment_expectation', `${item.label} expects ${item.expectedPaymentMethod === 'gtcc' ? 'GTCC' : 'personal'} payment.`, 'Review payment method');
    }

    if (!item || item.category !== expense.category) add(expense, 'unauthorized', `${expense.merchant} is not matched to an approved ${expense.category.replaceAll('_', ' ')} item.`, 'Review expense');
    else {
      checks.push({ expenseId: expense.id, code: 'authorized_category' });
      const group = grouped.get(item.id);
      if (group.at(-1).id === expense.id) {
        const groupTotal = round(group.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? authorizedBasis(row) : 0), 0));
        const difference = round(groupTotal - item.amount);
        // When the room is also over the lodging cap, that stricter exception carries the explanation.
        const overCap = item.category === 'lodging' && options.perDiem && group.some(row => analyzeLodging(row, options.perDiem)?.overCap > 0);
        if (difference > 25 && difference / item.amount > 0.05 && !overCap) {
          const basis = item.category === 'lodging' && group.some(row => authorizedBasis(row) !== row.amount) ? ' (room cost, excluding lodging tax)' : '';
          add(expense, 'over_authorization', `${item.label} is ${money(difference)} above the authorized ${money(item.amount)}${basis}.`, 'Add explanation', { difference, authorizedAmount: item.amount });
        } else checks.push({ expenseId: expense.id, code: 'amount_within_tolerance' });
      }
    }

    const receiptRequired = expense.category !== 'meals' && (expense.amount >= 75 || ['airfare', 'lodging', 'rental_car'].includes(expense.category));
    if (receiptRequired && !expense.receipt) add(expense, 'receipt_missing', `${money(expense.amount)} ${expense.category.replaceAll('_', ' ')} expense needs a receipt.`, 'Upload receipt', { rule: rules.receipts.cite });
    else checks.push({ expenseId: expense.id, code: 'receipt' });
    // Missing-field problems are cleared once the traveler has entered those fields; document-type problems stay.
    const receiptProblems = (expense.extraction?.validity?.problems || []).filter(problem =>
      !(/vendor name/.test(problem) && expense.merchant) && !(/transaction date/.test(problem) && expense.date) && !(/paid total/.test(problem) && expense.amount > 0));
    if (receiptRequired && expense.receipt && receiptProblems.length) {
      add(expense, 'receipt_not_itemized', receiptProblems.join(' '), 'Upload itemized receipt', { rule: rules.validReceipt.cite });
    }

    const lodging = options.perDiem ? analyzeLodging(expense, options.perDiem) : null;
    if (lodging?.overCap > 0) {
      add(expense, 'lodging_over_cap', `Room cost ${money(lodging.room)} for ${lodging.nights} ${lodging.nights === 1 ? 'night' : 'nights'} is ${money(lodging.overCap)} over the ${money(lodging.cap)} lodging cap. That needs actual-expense authorization, or you pay the difference.`, 'Add explanation', { rule: rules.lodgingCap.cite, overCap: lodging.overCap });
    } else if (lodging?.nights) checks.push({ expenseId: expense.id, code: 'lodging_cap', lodging });
    if (lodging?.tax > 0) checks.push({ expenseId: expense.id, code: 'lodging_tax_split', rule: rules.lodgingTax.cite, room: lodging.room, tax: lodging.tax });

    const returnFlight = item?.category === 'airfare' && /return|inbound|home/i.test(item.label) && Boolean(item.date);
    if (returnFlight && expense.date !== item.date) add(expense, 'itinerary_changed', `Return flight was ${formatDate(expense.date)}; authorization says ${formatDate(item.date)}.`, 'Confirm return date', { authorizedDate: item.date, actualDate: expense.date });
    else if (expense.date < trip.startDate || (expense.date > trip.endDate && !returnFlight)) add(expense, 'outside_dates', `${formatDate(expense.date)} is outside the approved travel dates.`, 'Review date');
    else checks.push({ expenseId: expense.id, code: 'travel_dates' });

    if (expense.category === 'lodging' && item?.startDate && item?.endDate && (expense.serviceStartDate !== item.startDate || expense.serviceEndDate !== item.endDate)) add(expense, 'lodging_dates', 'Hotel stay dates differ from the authorized nights or need confirmation.', 'Review stay dates');
    else if (expense.category === 'lodging') checks.push({ expenseId: expense.id, code: 'lodging_dates' });

    const key = `${expense.date}|${String(expense.merchant || '').trim().toLowerCase()}|${Number.isFinite(expense.amount) ? expense.amount.toFixed(2) : 'invalid'}`;
    if (fingerprints.has(key)) add(expense, 'possible_duplicate', `Looks like a duplicate of ${fingerprints.get(key)}.`, 'Review duplicate', { rule: rules.duplicate.cite });
    else { fingerprints.set(key, expense.merchant); checks.push({ expenseId: expense.id, code: 'duplicate' }); }
  }

  const meals = expenses.filter(expense => expense.category === 'meals' && Number.isFinite(expense.amount));
  if (options.perDiem?.supported && meals.length) {
    const claimed = round(meals.reduce((sum, expense) => sum + expense.amount, 0));
    const allowance = options.perDiem.totals.mie;
    if (claimed - allowance > 0.009) add(meals.at(-1), 'mie_over_entitlement', `You entered ${money(claimed)} for meals, but your M&IE allowance for this trip is ${money(allowance)}. M&IE is a flat allowance, so DTS computes it for you. Lower this to ${money(allowance)} or remove it.`, 'Edit expense', { rule: rules.firstLastDay.cite, allowance });
  }

  const validUsd = expenses.filter(e => e.currency === trip.currency && Number.isFinite(e.amount) && e.amount > 0);
  const total = round(validUsd.reduce((sum, expense) => sum + expense.amount, 0));
  const gtcc = round(validUsd.filter(e => e.paymentMethod === 'gtcc').reduce((sum, e) => sum + e.amount, 0));
  const personal = round(validUsd.filter(e => e.paymentMethod === 'personal').reduce((sum, e) => sum + e.amount, 0));
  const authorizedTotal = round(trip.authorizedItems.reduce((sum, item) => sum + item.amount, 0));
  return { issues, checks, perDiem: options.perDiem || null, ready: expenses.length > 0 && issues.length === 0, totals: { authorized: authorizedTotal, actual: total, gtcc, traveler: personal } };
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
