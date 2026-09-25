import { lodgingCapFor } from './perDiem.js';

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Split a lodging folio into room cost and lodging tax. CONUS lodging tax is reimbursed as its own
 * expense and does not count against the lodging cap, so DTS needs two lines, not one.
 */
export function analyzeLodging(expense, perDiem) {
  if (expense?.category !== 'lodging' || !Number.isFinite(expense.amount)) return null;
  const tax = Number.isFinite(expense.taxes) && expense.taxes > 0 ? round(expense.taxes) : 0;
  const fees = Number.isFinite(expense.fees) && expense.fees > 0 ? round(expense.fees) : 0;
  const room = round(expense.amount - tax - fees);
  const checkIn = expense.serviceStartDate;
  const checkOut = expense.serviceEndDate;
  const cap = perDiem?.days?.length && checkIn && checkOut ? lodgingCapFor(perDiem, checkIn, checkOut) : null;
  const nights = cap?.nights || null;
  return {
    room, tax, fees, nights,
    nightly: nights ? round(room / nights) : null,
    cap: cap?.cap ?? null,
    perNight: cap?.perNight || [],
    overCap: cap && cap.nights ? Math.max(0, round(room - cap.cap)) : 0,
    underCap: cap && cap.nights ? Math.max(0, round(cap.cap - room)) : 0
  };
}
