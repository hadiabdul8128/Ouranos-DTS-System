import { localReceiptExtractor } from './receiptExtractor.js';
import { parseReceiptText } from './receiptParser.js';
export { inferCategory, parseReceiptText } from './receiptParser.js';

export function extractReceiptText(text) { return parseReceiptText(text).fields; }

/** Provider boundary: each extractor returns the same auditable fields and OCR text. */
export async function extractReceipt(file, extractor = localReceiptExtractor) {
  if (!extractor || typeof extractor.extract !== 'function') throw new Error('Receipt extractor is unavailable.');
  const extraction = await extractor.extract(file);
  if (!extraction || typeof extraction.rawText !== 'string' || !extraction.fields || !extraction.confidence) {
    throw new Error('Receipt extractor returned an invalid result.');
  }
  return extraction;
}

export async function readReceipt(file, extractor = localReceiptExtractor) {
  const extraction = await extractReceipt(file, extractor);
  return {
    fields: extraction.fields, confidence: extraction.confidence, candidates: extraction.candidates,
    text: extraction.rawText, extraction,
    receipt: { name: file.name, type: file.type, dataUrl: await fileToDataUrl(file), sha256: await sha256(file), capturedAt: new Date().toISOString() }
  };
}

/** Evidence hash taken at capture; the image, not the OCR output, is the ground truth. */
async function sha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
