import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledTables, computePerDiem, findLocality, fiscalYear } from '../src/perDiem.js';

const plan = (destination, startDate, endDate, extra = {}) => computePerDiem({ destination, startDate, endDate, ...extra });

test('fiscal year starts Oct 1', () => {
  assert.equal(fiscalYear('2026-09-30'), 2026);
  assert.equal(fiscalYear('2026-10-01'), 2027);
});

test('San Diego FY2027: lodging cap per night and first/last-day 75% M&IE', () => {
  const result = plan('San Diego, CA', '2026-10-12', '2026-10-15');
  assert.equal(result.supported, true);
  assert.deepEqual(result.days.map(day => day.lodgingCap), [208, 208, 208, null]);
  assert.deepEqual(result.days.map(day => day.mie), [64.5, 86, 86, 64.5]);
  assert.deepEqual(result.totals, { mie: 301, lodgingCap: 624, nights: 3 });
  assert.match(result.days[0].source, /GSA Per Diem API · CONUS FY2027 · San Diego, CA · Oct/);
});

test('75% travel-day M&IE matches GSA’s own first/last-day figure for every tier', () => {
  for (const table of Object.values(bundledTables)) {
    for (const tier of table.mie) assert.equal(Math.round(tier.total * 0.75 * 100) / 100, tier.firstLastDay);
  }
});

test('a trip across Oct 1 prices each night from its own fiscal-year table', () => {
  const result = plan('San Diego, CA', '2026-09-29', '2026-10-02');
  assert.deepEqual(result.days.map(day => day.fiscalYear), [2026, 2026, 2027, 2027]);
  assert.deepEqual(result.days.map(day => day.lodgingCap), [199, 199, 208, null]);
  assert.ok(result.warnings.some(warning => /crosses Oct 1/.test(warning)));
});

test('seasonal lodging caps follow the month', () => {
  assert.equal(plan('San Diego, CA', '2026-06-10', '2026-06-11').days[0].lodgingCap, 237);
});

test('provided meals are deducted using the M&IE breakdown', () => {
  const result = plan('San Diego, CA', '2026-10-12', '2026-10-15', { mealsProvided: { '2026-10-13': { lunch: true }, '2026-10-14': { breakfast: true, lunch: true, dinner: true } } });
  assert.equal(result.days[1].mie, 86 - 23);
  assert.equal(result.days[2].mie, 5); // all three provided → incidentals only
  assert.equal(result.totals.mie, 64.5 + 63 + 5 + 64.5);
});

test('locality lookup: city, county list, and state standard rate', () => {
  const fy27 = bundledTables[2027];
  assert.equal(findLocality(fy27, 'Arlington, TX').location.city, 'Arlington / Fort Worth / Grapevine');
  const arlingtonVa = findLocality(fy27, 'Arlington, VA');
  assert.equal(arlingtonVa.match, 'county');
  assert.equal(arlingtonVa.location.state, 'DC');
  assert.equal(findLocality(fy27, 'Washington, DC').location.city, 'District of Columbia');
  const standard = findLocality(fy27, 'Norfolk, VA');
  assert.equal(standard.match, 'standard');
  assert.match(standard.warning, /DTMO/);
  // Sedona is carved out of the Flagstaff county locality and has its own row.
  assert.equal(findLocality(fy27, 'Sedona, AZ').location.meals, 92);
});

test('out-of-scope cases are flagged instead of estimated', () => {
  assert.equal(plan('San Diego, CA', '2026-10-01', '2026-11-15').supported, false);
  assert.equal(plan('San Diego, CA', '2026-10-12', '2026-10-15', { governmentMess: true }).supported, false);
  assert.equal(plan('San Diego, CA', '2030-10-12', '2030-10-15').supported, false);
  const bad = plan('San Diego', '2026-10-12', '2026-10-15');
  assert.equal(bad.supported, false);
  assert.match(bad.warnings[0], /City, ST/);
  assert.ok(plan('San Diego, CA', '2026-10-12', '2026-10-12').warnings.some(warning => /12 hours/.test(warning)));
});
