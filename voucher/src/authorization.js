import { categoryLabels } from './data.js';

const categories = new Set(Object.keys(categoryLabels));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T12:00:00`));

/** The Authorization flow can hand this shape to Voucher without sharing UI code. */
export function normalizeAuthorization(input) {
  const raw = input?.trip || input?.authorization || input;
  if (!raw || typeof raw !== 'object') throw new Error('Authorization file must contain an object.');
  const status = String(raw.authorizationStatus || raw.status || '').toLowerCase();
  if (status !== 'approved') throw new Error('Only approved authorizations can start a voucher.');
  const id = String(raw.id || raw.tripId || '').trim();
  const authorizationId = String(raw.authorizationId || raw.id || '').trim();
  const origin = String(raw.origin || '').trim();
  const destination = String(raw.destination || '').trim();
  const startDate = raw.startDate || raw.departureDate;
  const endDate = raw.endDate || raw.returnDate;
  const currency = String(raw.currency || 'USD').toUpperCase();
  if (!id || !authorizationId || !origin || !destination || !validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('Authorization needs an ID, origin, destination, and valid travel dates.');
  }
  if (currency !== 'USD') throw new Error('This voucher version requires a USD authorization.');
  const sourceItems = raw.authorizedItems || raw.items;
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) throw new Error('Authorization needs at least one approved expense item.');
  const seen = new Set();
  const authorizedItems = sourceItems.map((item, index) => {
    const itemId = String(item.id || '').trim();
    const category = String(item.category || '').trim();
    const amount = Number(item.amount);
    if (!itemId || seen.has(itemId) || !categories.has(category) || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`Approved item ${index + 1} needs a unique ID, known category, and valid amount.`);
    }
    seen.add(itemId);
    const expectedPaymentMethod = item.expectedPaymentMethod || item.paymentMethodExpectation;
    if (expectedPaymentMethod && !['gtcc', 'personal'].includes(expectedPaymentMethod)) throw new Error(`Approved item ${index + 1} has an invalid expected payment method.`);
    return {
      id: itemId, category, label: String(item.label || categoryLabels[category]).trim(), amount,
      ...(item.merchant ? { merchant: String(item.merchant).trim() } : {}),
      ...(item.location ? { location: String(item.location).trim() } : {}),
      ...(expectedPaymentMethod ? { expectedPaymentMethod } : {}),
      ...(validDate(item.date) ? { date: item.date } : {}),
      ...(validDate(item.startDate) ? { startDate: item.startDate } : {}),
      ...(validDate(item.endDate) ? { endDate: item.endDate } : {}),
      ...(Number.isFinite(Number(item.nights)) && item.nights != null ? { nights: Number(item.nights) } : {})
    };
  });
  return { id, authorizationId, traveler: String(raw.traveler || '').trim(), origin, destination, startDate, endDate, purpose: String(raw.purpose || '').trim(), authorizationStatus: 'Approved', currency, authorizedItems };
}
