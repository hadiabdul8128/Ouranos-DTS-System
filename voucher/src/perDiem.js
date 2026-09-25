import fy2026 from './rates/conus-fy2026.js';
import fy2027 from './rates/conus-fy2027.js';

/** Bundled GSA tables keyed by federal fiscal year (Oct 1 – Sep 30). */
export const bundledTables = { 2026: fy2026, 2027: fy2027 };

const stateNames = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const norm = value => ` ${String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const meals = ['breakfast', 'lunch', 'dinner'];

export function fiscalYear(date) {
  const [year, month] = date.split('-').map(Number);
  return month >= 10 ? year + 1 : year;
}

/** Index into a fiscal-year row whose columns run Oct..Sep. */
const monthIndex = date => (Number(date.slice(5, 7)) + 2) % 12;

function addDays(date, days) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function parseDestination(value) {
  const match = /^\s*(.+?),\s*([A-Za-z]{2})\s*$/.exec(String(value || ''));
  return match ? { city: match[1].trim(), state: match[2].toUpperCase() } : { city: String(value || '').trim(), state: '' };
}

/** Locality lookup: exact city, then a county/city list that names it, then the state standard rate. */
export function findLocality(table, destination) {
  const { city, state } = parseDestination(destination);
  if (!state || !stateNames[state]) return { location: null, match: 'none', warning: `Enter the duty location as “City, ST” so the ${table.source} rate can be looked up.` };
  const rows = table.locations;
  const byCity = rows.find(row => row.state === state && row.city.split('/').some(name => norm(name) === norm(city)))
    || (state === 'DC' ? rows.find(row => row.state === 'DC') : null);
  if (byCity) return { location: byCity, match: 'city', warning: '' };
  const byCounty = rows.find(row => {
    const county = norm(row.county);
    if (!county.includes(norm(city)) || county.includes(`less the city of${norm(city)}`)) return false;
    return row.state === state || county.includes(norm(stateNames[state]));
  });
  if (byCounty) return { location: byCounty, match: 'county', warning: `${city} is covered by the ${byCounty.city}, ${byCounty.state} locality. Confirm on the DTMO rate lookup.` };
  const standard = rows.find(row => row.state === state && /standard rate/i.test(row.city));
  if (standard) return { location: standard, match: 'standard', warning: `${city}, ${state} is not a listed locality, so the ${state} standard rate applies unless your duty location's county is listed. Military installations can have their own DTMO rate, so confirm on the DTMO lookup.` };
  return { location: null, match: 'none', warning: `No ${table.source} rate found for ${destination}.` };
}

/**
 * Deterministic per-diem plan for a simple CONUS TDY. Every number carries its source row.
 * Out of scope (flagged, never estimated): long-term TDY Lodging-Plus, the Government Meal Rate, and OCONUS.
 */
export function computePerDiem({ startDate, endDate, destination, mealsProvided = {}, governmentMess = false }, tables = bundledTables) {
  const warnings = [];
  const days = [];
  if (!startDate || !endDate || startDate > endDate) return { supported: false, days, totals: { mie: 0, lodgingCap: 0, nights: 0 }, warnings: ['Trip dates are missing or out of order.'] };
  const dates = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date);
  const nights = dates.length - 1;
  let supported = true;
  if (nights > 30) {
    supported = false;
    warnings.push('Long-term TDY (more than 30 days) uses the Lodging-Plus computation, which this version does not compute. Work it with your DTA.');
  }
  if (governmentMess) {
    supported = false;
    warnings.push('A Government mess is available, so the Government Meal Rate applies. This version does not compute GMR; confirm M&IE with your DTA.');
  }
  if (dates.length === 1) warnings.push('Same-day travel: M&IE applies only when travel lasts more than 12 hours, at 75%. Confirm with your DTA.');

  const localities = new Map();
  for (const [index, date] of dates.entries()) {
    const fy = fiscalYear(date);
    const table = tables[fy];
    if (!table) {
      supported = false;
      days.push({ date, fiscalYear: fy, missingTable: true, lodgingCap: null, mie: 0, mieRate: null, deductions: 0, travelDay: false, provided: [] });
      continue;
    }
    if (!localities.has(fy)) localities.set(fy, findLocality(table, destination));
    const locality = localities.get(fy);
    if (!locality.location) { supported = false; days.push({ date, fiscalYear: fy, missingLocality: true, lodgingCap: null, mie: 0, mieRate: null, deductions: 0, travelDay: false, provided: [] }); continue; }
    const row = locality.location;
    const tier = table.mie.find(entry => entry.total === row.meals);
    const travelDay = index === 0 || index === dates.length - 1;
    const base = travelDay ? round(row.meals * 0.75) : row.meals;
    const provided = meals.filter(meal => mealsProvided[date]?.[meal]);
    const deductions = tier ? provided.reduce((sum, meal) => sum + tier[meal], 0) : 0;
    if (provided.length && !tier) warnings.push(`No M&IE breakdown for $${row.meals} in FY${fy}; provided meals on ${date} were not deducted.`);
    if (base - deductions < 0) warnings.push(`Provided meals on ${date} exceed the travel-day M&IE; allowance set to $0. Confirm with your DTA.`);
    days.push({
      date, fiscalYear: fy, travelDay, provided,
      lodgingCap: index < dates.length - 1 ? row.lodging[monthIndex(date)] : null,
      mieRate: row.meals, mieBase: base, deductions, mie: Math.max(0, round(base - deductions)),
      source: `${table.source} · ${row.city}, ${row.state} · ${table.monthOrder[monthIndex(date)]}`
    });
  }
  for (const locality of localities.values()) if (locality.warning && !warnings.includes(locality.warning)) warnings.push(locality.warning);
  if (localities.size > 1) warnings.push(`This trip crosses Oct 1, so days are priced from two fiscal-year tables (${[...localities.keys()].map(fy => `FY${fy}`).join(' and ')}).`);
  const firstLocality = [...localities.values()][0];
  return {
    supported, days, warnings,
    locality: firstLocality?.location ? { name: `${firstLocality.location.city}, ${firstLocality.location.state}`, match: firstLocality.match } : null,
    totals: {
      mie: round(days.reduce((sum, day) => sum + day.mie, 0)),
      lodgingCap: round(days.reduce((sum, day) => sum + (day.lodgingCap || 0), 0)),
      nights
    }
  };
}

/** Lodging cap for the nights a folio covers (check-in night through the night before check-out). */
export function lodgingCapFor(perDiem, checkIn, checkOut) {
  const nights = perDiem.days.filter(day => day.lodgingCap != null && day.date >= checkIn && day.date < checkOut);
  return { nights: nights.length, cap: round(nights.reduce((sum, day) => sum + day.lodgingCap, 0)), perNight: nights.map(day => ({ date: day.date, cap: day.lodgingCap })) };
}
