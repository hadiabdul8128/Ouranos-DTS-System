import { categoryLabels } from './data.js';

const categoryHints = {
  fuel: /\bgas\b|gasoline|fuel|petrol|shell|exxon|chevron/i,
  lodging: /hotel|motel|inn|lodging|folio|marriott|hilton|hyatt/i,
  rental_car: /rental car|car rental|enterprise|hertz|avis|budget rental/i,
  airfare: /airline|airways|flight|ticket|boarding/i,
  parking: /parking|garage/i,
  ground_transport: /taxi|cab|uber|lyft|rideshare/i,
  baggage: /baggage|checked bag/i,
  meals: /restaurant|cafe|diner|meal|breakfast|lunch|dinner/i
};

const moneyPattern = /(?:[$€£]\s*|(?:USD|EUR|GBP|CAD)\s*)?-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2}|,\d{2})\b/gi;
const datePattern = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b|\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b|\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;

export function inferCategory(text) {
  return Object.entries(categoryHints).find(([, pattern]) => pattern.test(text || ''))?.[0] || 'other';
}

function parseMoney(raw) {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  const normalized = cleaned.includes('.') ? cleaned.replaceAll(',', '') : cleaned.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function valuesOn(line) {
  return [...String(line || '').matchAll(moneyPattern)].map(match => parseMoney(match[0])).filter(value => value != null);
}

function valueForLabel(lines, index) {
  const direct = valuesOn(lines[index]);
  if (direct.length) return direct.at(-1);
  const next = lines[index + 1] || '';
  return !/[a-z]/i.test(next.replace(/\b(?:USD|EUR|GBP|CAD)\b/gi, '')) ? valuesOn(next)[0] ?? null : null;
}

function dateFromMatch(match) {
  let year, month, day;
  if (match[1]) [year, month, day] = [match[1], match[2], match[3]];
  else if (match[4]) [year, month, day] = [match[6].length === 2 ? `20${match[6]}` : match[6], match[4], match[5]];
  else {
    year = match[9];
    month = String(new Date(`${match[7]} 1, 2000`).getMonth() + 1);
    day = match[8];
  }
  const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(year) && parsed.getMonth() + 1 === Number(month) && parsed.getDate() === Number(day) ? value : '';
}

function datesOn(line) {
  return [...String(line || '').matchAll(datePattern)].map(dateFromMatch).filter(Boolean);
}

function labeledDate(lines, label) {
  const index = lines.findIndex(line => label.test(line));
  if (index < 0) return '';
  return datesOn(lines[index])[0] || datesOn(lines[index + 1])[0] || '';
}

function optionalMoney(lines, label) {
  const candidates = lines.flatMap((line, index) => label.test(line) ? [valueForLabel(lines, index)] : []).filter(value => value != null);
  const distinct = [...new Set(candidates)];
  return { value: distinct.length === 1 ? distinct[0] : null, confidence: distinct.length === 1 ? 'high' : 'low' };
}

/** Parse OCR text without treating an unlabeled dollar figure as a verified total. */
export function parseReceiptText(rawText) {
  const lines = String(rawText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totals = [];
  const allMoney = [];
  for (const [index, line] of lines.entries()) {
    for (const value of valuesOn(line)) allMoney.push({ value, line });
    const label = line.replace(/^[^a-z]*/i, '').toLowerCase();
    if (/^(?:sub[ -]?total|total tax|tax total)/.test(label)) continue;
    const priority = /^(?:amount paid|total paid|paid total|card charged|amount charged|payment total)\b/.test(label) ? 5
      : /^(?:grand total|final total|total due)\b/.test(label) ? 4
        : /^total\b/.test(label) ? 3
          : /^balance due\b/.test(label) ? 2
            : /^balance\b/.test(label) ? 1 : 0;
    const value = priority ? valueForLabel(lines, index) : null;
    if (value != null) totals.push({ value, label: line, priority });
  }
  const bestPriority = Math.max(0, ...totals.map(item => item.priority));
  const best = totals.filter(item => item.priority === bestPriority);
  const distinctBest = [...new Set(best.map(item => item.value))];
  const distinctUnlabeled = [...new Set(allMoney.map(item => item.value))];
  const amount = bestPriority ? distinctBest.length === 1 ? distinctBest[0] : null
    : distinctUnlabeled.length === 1 ? distinctUnlabeled[0] : null;
  const amountConfidence = amount == null ? 'low' : bestPriority >= 3 ? 'high' : 'medium';

  const dateLines = lines.flatMap(line => datesOn(line).map(value => ({ value, label: line })));
  const transactionDates = dateLines.filter(item => /\b(?:date|transaction|purchased|paid)\b/i.test(item.label));
  const selectedDates = transactionDates.length ? transactionDates : dateLines.filter(item => !/check[ -]?(?:in|out)/i.test(item.label));
  const distinctDates = [...new Set(selectedDates.map(item => item.value))];
  const date = distinctDates.length === 1 ? distinctDates[0] : '';
  const dateConfidence = !date ? 'low' : transactionDates.length ? 'high' : 'medium';

  const headerEnd = lines.findIndex(line => /^ad(?:d)?r|^tel|^phone|^date\b|\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/i.test(line));
  const header = lines.slice(0, headerEnd >= 0 ? headerEnd : Math.min(lines.length, 4));
  const merchantIndex = header.findIndex(line => /[A-Za-z]{3}/.test(line) && !/\b(receipt|invoice|cash|thank you|order|transaction)\b/i.test(line) && !/^\d+\s/.test(line));
  const merchant = merchantIndex >= 0 ? header[merchantIndex] : '';
  const location = lines.find(line => /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)) || '';
  const address = lines.find(line => /^\d+\s+[^\n]*(?:st(?:reet)?|ave(?:nue)?|road|rd|blvd|boulevard|drive|dr|lane|ln)\b/i.test(line)) || '';
  const category = inferCategory(`${merchant}\n${rawText}`);
  const paymentMethod = /\b(?:gtcc|government travel (?:charge )?card)\b/i.test(rawText) ? 'gtcc'
    : /\b(?:cash|personal card|paid personally)\b/i.test(rawText) ? 'personal' : '';
  const currencyMatch = /\b(EUR|GBP|CAD|USD)\b/i.exec(rawText);
  const symbol = /[$€£]/.exec(rawText)?.[0];
  const currency = currencyMatch?.[1]?.toUpperCase() || ({ '€': 'EUR', '£': 'GBP', '$': 'USD' })[symbol] || 'USD';
  const taxes = optionalMoney(lines, /^(?:(?:sales|occupancy|city|state|room|lodging)\s+)?tax(?:es)?\b/i);
  const fees = optionalMoney(lines, /^(?:service|booking|convenience|resort|facility)?\s*fees?\b/i);
  const subtotal = optionalMoney(lines, /^sub[ -]?total\b/i);
  const tip = optionalMoney(lines, /^(?:tip|gratuity)\b/i);
  const serviceStartDate = labeledDate(lines, /check[ -]?in|arrival/i);
  const serviceEndDate = labeledDate(lines, /check[ -]?out|departure/i);
  const fields = { merchant, date, amount, taxes: taxes.value, fees: fees.value, subtotal: subtotal.value, tip: tip.value, currency, location, address, category, paymentMethod, serviceStartDate, serviceEndDate, categoryLabel: categoryLabels[category] };
  const confidence = {
    merchant: merchant ? merchantIndex === 0 ? 'high' : 'medium' : 'low', date: dateConfidence, amount: amountConfidence,
    taxes: taxes.confidence, fees: fees.confidence, subtotal: subtotal.confidence, tip: tip.confidence,
    currency: currencyMatch ? 'high' : symbol ? 'medium' : 'low', location: location ? 'high' : 'low', address: address ? 'medium' : 'low',
    category: category === 'other' ? 'low' : 'medium', paymentMethod: paymentMethod ? 'high' : 'low',
    serviceStartDate: serviceStartDate ? 'high' : 'low', serviceEndDate: serviceEndDate ? 'high' : 'low'
  };
  return { fields, confidence, candidates: { totals, amounts: distinctUnlabeled, dates: distinctDates } };
}
