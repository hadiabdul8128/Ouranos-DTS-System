import { categoryLabels } from './data.js';

const categories = new Set(Object.keys(categoryLabels));
const text = value => typeof value === 'string' ? value.trim() : '';

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sameAlias(primary, legacy, label) {
  if (primary != null && legacy != null && primary !== legacy) throw new Error(`${label} has conflicting values.`);
  return primary ?? legacy;
}

/** Validate the canonical handoff while accepting the existing JSON format. */
export function normalizeAuthorization(input) {
  const raw = input?.trip || input?.authorization || input;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Authorization must contain an object.');
  const canonical = raw.tripId != null || raw.approvedExpenseItems != null;
  const status = text(sameAlias(raw.status, raw.authorizationStatus, 'Authorization status'));
  if (status.toLowerCase() !== 'approved') throw new Error('Only approved authorizations can start a voucher.');
  const id = text(sameAlias(raw.tripId, raw.id, 'Trip ID'));
  const authorizationId = text(raw.authorizationId || (canonical ? '' : raw.id));
  const traveler = text(raw.traveler);
  const origin = text(raw.origin);
  const destination = text(raw.destination);
  const startDate = sameAlias(raw.departureDate, raw.startDate, 'Departure date');
  const endDate = sameAlias(raw.returnDate, raw.endDate, 'Return date');
  const currency = text(raw.currency || (canonical ? '' : 'USD')).toUpperCase();
  if (!id || !authorizationId || (canonical && !traveler) || !origin || !destination || !validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('Authorization needs trip and authorization IDs, traveler, origin, destination, and valid travel dates.');
  }
  if (currency !== 'USD') throw new Error('This voucher version requires a USD authorization.');
  const sourceItems = sameAlias(raw.approvedExpenseItems, raw.authorizedItems, 'Approved expense items') ?? raw.items;
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) throw new Error('Authorization needs at least one approved expense item.');

  const seen = new Set();
  const authorizedItems = sourceItems.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Approved item ${index + 1} must be an object.`);
    for (const key of ['merchant', 'location']) {
      if (item[key] != null && typeof item[key] !== 'string') throw new Error(`Approved item ${index + 1} has an invalid ${key}.`);
    }
    const itemId = text(item.id);
    const category = text(item.category);
    const suppliedAmount = sameAlias(item.authorizedAmount, item.amount, `Approved item ${index + 1} amount`);
    const amount = !canonical && typeof suppliedAmount === 'string' && suppliedAmount.trim() ? Number(suppliedAmount) : suppliedAmount;
    const label = text(sameAlias(item.description, item.label, `Approved item ${index + 1} description`)) || (canonical ? '' : categoryLabels[category]);
    if (!itemId || seen.has(itemId) || !categories.has(category) || !label || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`Approved item ${index + 1} needs a unique ID, known category, description, and valid authorized amount.`);
    }
    seen.add(itemId);
    const expectedPaymentMethod = sameAlias(item.expectedPaymentMethod, item.paymentMethodExpectation, `Approved item ${index + 1} payment method`);
    if (expectedPaymentMethod && !['gtcc', 'personal'].includes(expectedPaymentMethod)) throw new Error(`Approved item ${index + 1} has an invalid expected payment method.`);
    for (const key of ['date', 'startDate', 'endDate']) {
      if (item[key] != null && !validDate(item[key])) throw new Error(`Approved item ${index + 1} has an invalid ${key}.`);
    }
    if ((item.startDate && !item.endDate) || (!item.startDate && item.endDate) || (item.startDate && item.startDate > item.endDate)) {
      throw new Error(`Approved item ${index + 1} needs a valid start and end date pair.`);
    }
    if (item.nights != null && (!Number.isInteger(item.nights) || item.nights < 0)) throw new Error(`Approved item ${index + 1} has invalid nights.`);
    return {
      id: itemId, category, description: label, authorizedAmount: amount, label, amount,
      ...(item.merchant ? { merchant: text(item.merchant) } : {}),
      ...(item.location ? { location: text(item.location) } : {}),
      ...(expectedPaymentMethod ? { expectedPaymentMethod } : {}),
      ...(item.date ? { date: item.date } : {}),
      ...(item.startDate ? { startDate: item.startDate, endDate: item.endDate } : {}),
      ...(item.nights != null ? { nights: item.nights } : {})
    };
  });
  return {
    tripId: id, authorizationId, status: 'Approved', traveler, origin, destination,
    departureDate: startDate, returnDate: endDate, currency, purpose: text(raw.purpose),
    approvedExpenseItems: authorizedItems,
    id, startDate, endDate, authorizationStatus: 'Approved', authorizedItems
  };
}
