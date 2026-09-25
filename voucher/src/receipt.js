import { categoryLabels } from './data.js';

const categoryHints = {
  fuel: /\bgas\b|gasoline|fuel|petrol|shell|exxon|chevron/i,
  lodging: /hotel|inn|lodging|folio|suite/i,
  rental_car: /rental|enterprise|hertz|avis/i,
  airfare: /airline|airways|flight|ticket/i,
  parking: /parking|garage/i,
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
  const money = line => line?.match(/\b[\d,]+[.,]\d{2}\b/)?.[0];
  const totalIndex = lines.findIndex(line => /^(?:[^a-z]*)(?:grand\s+)?total\b|^amount paid\b|^balance due\b/i.test(line));
  const adjacentTotal = totalIndex >= 0 && !/[a-z]/i.test(lines[totalIndex + 1] || '') ? money(lines[totalIndex + 1]) : null;
  const amountText = totalIndex >= 0 ? money(lines[totalIndex]) || adjacentTotal : null;
  const fallbackAmount = [...text.matchAll(/\b[\d,]+[.,]\d{2}\b/g)].at(-1)?.[0];
  const rawAmount = amountText || fallbackAmount;
  const amount = rawAmount ? Number(rawAmount.includes('.') ? rawAmount.replace(/,/g, '') : rawAmount.replace(',', '.')) : null;
  const category = inferCategory(text);
  const headerEnd = lines.findIndex(line => /^ad(?:d)?r|^tel|^phone|^date\b|\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/i.test(line));
  const header = lines.slice(0, headerEnd >= 0 ? headerEnd : Math.min(lines.length, 4));
  const merchant = header.find(line => /[A-Za-z]{3}/.test(line) && !/\b(receipt|invoice|cash|thank you|order|transaction)\b/i.test(line) && !/^\d+\s/.test(line)) || '';
  const paymentMethod = /(?:government|gtcc|travel card)/i.test(text) ? 'gtcc' : /(?:personal|cash)/i.test(text) ? 'personal' : '';
  const currency = /\b(EUR|GBP|CAD)\b/i.exec(text)?.[1]?.toUpperCase() || 'USD';
  const location = lines.find(line => /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)) || '';
  return { merchant, date, amount, currency, category, paymentMethod, location, categoryLabel: categoryLabels[category] };
}

export async function readReceipt(file) {
  let text = '';
  if (file.type.startsWith('image/')) {
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, localOcrOptions());
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      text = (await worker.recognize(file)).data.text;
    }
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
        const { createWorker, PSM } = await import('tesseract.js');
        if (!ocrWorker) {
          ocrWorker = await createWorker('eng', 1, localOcrOptions());
          await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        }
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
