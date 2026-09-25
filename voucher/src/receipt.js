import { categoryLabels } from './data.js';

const categoryHints = {
  lodging: /hotel|inn|lodging|folio|suite/i,
  rental_car: /rental|enterprise|hertz|avis/i,
  airfare: /airline|airways|flight|ticket/i,
  parking: /parking|garage/i,
  fuel: /shell|exxon|fuel|gasoline/i,
  ground_transport: /taxi|cab|uber|lyft/i,
  baggage: /baggage|checked bag/i,
  meals: /restaurant|cafe|diner|meal/i
};

export function inferCategory(text) {
  return Object.entries(categoryHints).find(([, pattern]) => pattern.test(text || ''))?.[0] || 'other';
}

export function extractReceiptText(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const dateMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b|\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  let date = '';
  if (dateMatch) {
    const [year, month, day] = dateMatch[1] ? [dateMatch[1], dateMatch[2], dateMatch[3]] : [dateMatch[6], dateMatch[4], dateMatch[5]];
    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const totalLine = lines.findLast(line => /\b(total|amount paid|balance due)\b/i.test(line) && /\$?\d+[.,]\d{2}/.test(line));
  const amountMatches = (totalLine || text).match(/(?:\$|USD\s*)?([\d,]+\.\d{2})\b/g) || [];
  const amount = amountMatches.length ? Number(amountMatches.at(-1).replace(/[^\d.]/g, '')) : null;
  const category = inferCategory(text);
  const merchant = lines.find(line => /[A-Za-z]/.test(line) && !/receipt|invoice|date|total|amount/i.test(line)) || '';
  const paymentMethod = /(?:government|gtcc|travel card)/i.test(text) ? 'gtcc' : /(?:personal|cash)/i.test(text) ? 'personal' : '';
  const currency = /\b(EUR|GBP|CAD)\b/i.exec(text)?.[1]?.toUpperCase() || 'USD';
  const location = lines.find(line => /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)) || '';
  return { merchant, date, amount, currency, category, paymentMethod, location, categoryLabel: categoryLabels[category] };
}

export async function readReceipt(file) {
  let text = '';
  if (file.type.startsWith('image/')) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, localOcrOptions());
    try { text = (await worker.recognize(file)).data.text; }
    finally { await worker.terminate(); }
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    text = await readPdf(file);
  } else if (file.type === 'text/plain') text = await file.text();
  return { fields: extractReceiptText(text), text, receipt: { name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) } };
}

async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const doc = await loadingTask.promise;
  const pages = [];
  let ocrWorker;
  try {
    for (let number = 1; number <= Math.min(doc.numPages, 5); number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      let pageText = content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('');
      if (pageText.trim().length < 20) {
        const { createWorker } = await import('tesseract.js');
        ocrWorker ||= await createWorker('eng', 1, localOcrOptions());
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        pageText = (await ocrWorker.recognize(canvas)).data.text;
      }
      pages.push(pageText);
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    await loadingTask.destroy();
  }
  return pages.join('\n');
}

function localOcrOptions() {
  return { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr' };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
