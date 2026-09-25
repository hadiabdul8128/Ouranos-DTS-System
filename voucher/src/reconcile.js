const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const money = amount => `$${amount.toFixed(2)}`;

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
    const resolution = code === 'over_authorization' && candidate?.type === 'explanation' && String(candidate.value || '').trim().length >= 8
      ? candidate
      : code === 'itinerary_changed' && candidate?.type === 'confirmed_date' && candidate.value === expense.date
        ? candidate : null;
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
        const groupTotal = round(group.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0));
        const difference = round(groupTotal - item.amount);
        if (difference > 25 && difference / item.amount > 0.05) {
          add(expense, 'over_authorization', `${item.label} is ${money(difference)} above the authorized ${money(item.amount)}.`, 'Add explanation', { difference, authorizedAmount: item.amount });
        } else checks.push({ expenseId: expense.id, code: 'amount_within_tolerance' });
      }
    }

    const receiptRequired = expense.category !== 'meals' && (expense.amount >= 75 || ['airfare', 'lodging', 'rental_car'].includes(expense.category));
    if (receiptRequired && !expense.receipt) add(expense, 'receipt_missing', `${money(expense.amount)} ${expense.category.replaceAll('_', ' ')} expense needs a receipt.`, 'Upload receipt');
    else checks.push({ expenseId: expense.id, code: 'receipt' });

    const returnFlight = item?.category === 'airfare' && /return|inbound|home/i.test(item.label) && Boolean(item.date);
    if (returnFlight && expense.date !== item.date) add(expense, 'itinerary_changed', `Return flight was ${formatDate(expense.date)}; authorization says ${formatDate(item.date)}.`, 'Confirm return date', { authorizedDate: item.date, actualDate: expense.date });
    else if (expense.date < trip.startDate || (expense.date > trip.endDate && !returnFlight)) add(expense, 'outside_dates', `${formatDate(expense.date)} is outside the approved travel dates.`, 'Review date');
    else checks.push({ expenseId: expense.id, code: 'travel_dates' });

    if (expense.category === 'lodging' && item?.startDate && item?.endDate && (expense.serviceStartDate !== item.startDate || expense.serviceEndDate !== item.endDate)) add(expense, 'lodging_dates', 'Hotel stay dates differ from the authorized nights or need confirmation.', 'Review stay dates');
    else if (expense.category === 'lodging') checks.push({ expenseId: expense.id, code: 'lodging_dates' });

    const key = `${expense.date}|${String(expense.merchant || '').trim().toLowerCase()}|${Number.isFinite(expense.amount) ? expense.amount.toFixed(2) : 'invalid'}`;
    if (fingerprints.has(key)) add(expense, 'possible_duplicate', `Looks like a duplicate of ${fingerprints.get(key)}.`, 'Review duplicate');
    else { fingerprints.set(key, expense.merchant); checks.push({ expenseId: expense.id, code: 'duplicate' }); }
  }

  const validUsd = expenses.filter(e => e.currency === trip.currency && Number.isFinite(e.amount) && e.amount > 0);
  const total = round(validUsd.reduce((sum, expense) => sum + expense.amount, 0));
  const gtcc = round(validUsd.filter(e => e.paymentMethod === 'gtcc').reduce((sum, e) => sum + e.amount, 0));
  const personal = round(validUsd.filter(e => e.paymentMethod === 'personal').reduce((sum, e) => sum + e.amount, 0));
  const authorizedTotal = round(trip.authorizedItems.reduce((sum, item) => sum + item.amount, 0));
  return { issues, checks, ready: expenses.length > 0 && issues.length === 0, totals: { authorized: authorizedTotal, actual: total, gtcc, traveler: personal } };
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
