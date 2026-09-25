import { computePerDiem } from './perDiem.js';

/**
 * Companion-mode trip setup: the traveler types a reference from their DTS authorization
 * (no orders image is captured). These amounts are not verified approved amounts.
 */
export function buildManualAuthorization(input) {
  const text = key => String(input[key] ?? '').trim();
  const amount = key => input[key] === '' || input[key] == null ? 0 : Number(input[key]);
  const perDiem = computePerDiem({ startDate: text('startDate'), endDate: text('endDate'), destination: text('destination') });
  if (!perDiem.days.length) throw new Error(perDiem.warnings[0] || 'Check the trip dates.');
  if (!perDiem.supported) throw new Error(`${perDiem.warnings[0] || 'Per-diem rates are unavailable for this trip.'} Scan receipts now and wait for an approved authorization handoff.`);
  const items = [];
  if (perDiem.totals.nights && input.lodging !== false) {
    const caps = perDiem.days.filter(day => day.lodgingCap != null);
    if (caps.length === perDiem.totals.nights) {
      items.push({ id: 'lodging', category: 'lodging', description: `Lodging · ${perDiem.totals.nights} nights at the ${perDiem.locality.name} cap`, authorizedAmount: perDiem.totals.lodgingCap, startDate: text('startDate'), endDate: text('endDate'), nights: perDiem.totals.nights, location: text('destination'), expectedPaymentMethod: 'gtcc' });
    }
  }
  if (perDiem.totals.mie > 0) items.push({ id: 'mie', category: 'meals', description: 'Meals & incidentals (per diem)', authorizedAmount: perDiem.totals.mie });
  for (const [key, category, description] of [['airfare', 'airfare', 'Airfare'], ['rentalCar', 'rental_car', 'Rental car'], ['fuel', 'fuel', 'Rental car fuel'], ['parking', 'parking', 'Parking']]) {
    const value = amount(key);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${description} estimate must be a positive number.`);
    if (value > 0) items.push({ id: key, category, description, authorizedAmount: value, ...(category === 'airfare' || category === 'rental_car' || category === 'fuel' ? { expectedPaymentMethod: 'gtcc' } : {}) });
  }
  if (!items.length) throw new Error('Add at least one estimated expense.');
  return {
    authorization: {
      tripId: `TRIP-${text('startDate')}-${text('destination').replace(/[^A-Za-z]+/g, '').slice(0, 12).toUpperCase()}`,
      authorizationId: text('authorizationId') || 'Not provided',
      status: 'TravelerEntered', entrySource: 'traveler', traveler: text('traveler') || 'Traveler', origin: text('origin'), destination: text('destination'),
      departureDate: text('startDate'), returnDate: text('endDate'), currency: 'USD', purpose: 'Traveler-entered trip reference; approval and amounts not verified',
      approvedExpenseItems: items
    },
    perDiem
  };
}
