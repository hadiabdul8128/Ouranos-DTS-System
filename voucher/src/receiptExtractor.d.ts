import type { ExpenseCategory, PaymentMethod } from './travelAuthorization';

export type FieldConfidence = 'high' | 'medium' | 'low';

export interface ReceiptFields {
  merchant: string;
  date: string;
  amount: number | null; // final paid total, not subtotal or balance
  subtotal: number | null;
  taxes: number | null;
  fees: number | null;
  tip: number | null;
  currency: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod | '';
  location: string;
  address: string;
  serviceStartDate: string;
  serviceEndDate: string;
}

export interface ReceiptExtraction {
  rawText: string;
  fields: ReceiptFields;
  confidence: Record<keyof ReceiptFields, FieldConfidence>;
  candidates?: { totals?: { value: number; label: string; priority: number }[]; amounts?: number[]; dates?: string[] };
}

/** Future OCR or vision providers implement this without changing Voucher. */
export interface ReceiptExtractor {
  extract(file: File): Promise<ReceiptExtraction>;
}
