import { computePerDiem } from './perDiem.js';

/**
 * Companion-mode trip setup: the traveler types the few facts from their approved DTS authorization
 * (no orders image is captured). Lodging and M&IE estimates come from the per-diem engine, never guessed.
 */
export function buildManualAuthorization(input) {
  const text = key => String(input[key] ?? '').trim();
  const amount = key => input[key] === '' || input[key] == null ? 0 : Number(input[key]);
  const perDiem = computePerDiem({ startDate: text('startDate'), endDate: text('endDate'), destination: text('destination') });
  if (!perDiem.days.length) throw new Error(perDiem.warnings[0] || 'Check the trip dates.');
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
  if (!items.length) throw new Error('Add at least one approved expense.');
  return {
    authorization: {
      tripId: `TRIP-${text('startDate')}-${text('destination').replace(/[^A-Za-z]+/g, '').slice(0, 12).toUpperCase()}`,
      authorizationId: text('authorizationId') || 'DTS-AUTH',
      status: 'Approved', traveler: text('traveler') || 'Traveler', origin: text('origin'), destination: text('destination'),
      departureDate: text('startDate'), returnDate: text('endDate'), currency: 'USD', purpose: 'Entered by traveler from approved DTS authorization',
      approvedExpenseItems: items
    },
    perDiem
  };
}
