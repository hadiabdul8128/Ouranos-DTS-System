import { parseReceiptText } from './receiptParser.js';

/** Default extractor; OCR and parsing stay on the device. */
export const localReceiptExtractor = {
  async extract(file) {
    let rawText = '';
    if (file.type.startsWith('image/')) {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, localOcrOptions());
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        rawText = (await worker.recognize(file)).data.text;
      } finally { await worker.terminate(); }
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      rawText = await readPdf(file);
    } else if (file.type === 'text/plain') rawText = await file.text();
    else throw new Error('Choose an image, PDF, or text receipt.');
    const parsed = parseReceiptText(rawText);
    return { rawText, fields: parsed.fields, confidence: parsed.confidence, candidates: parsed.candidates };
  }
};

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
