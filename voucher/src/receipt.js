import { parseReceiptText } from './receiptParser.js';
export { inferCategory, parseReceiptText } from './receiptParser.js';

export function extractReceiptText(text) { return parseReceiptText(text).fields; }

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
  const parsed = parseReceiptText(text);
  const extraction = { rawText: text, fields: parsed.fields, confidence: parsed.confidence, candidates: parsed.candidates };
  return { ...parsed, text, extraction, receipt: { name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) } };
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
