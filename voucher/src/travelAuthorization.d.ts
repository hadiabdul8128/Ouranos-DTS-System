/** Approved trip passed to the Voucher by the Authorization feature. Dates use YYYY-MM-DD. */
export interface TravelAuthorization {
  id: string;
  authorizationId: string;
  authorizationStatus: 'Approved';
  traveler?: string;
  origin: string;
  destination: string;
  startDate: string; // departure date
  endDate: string; // return date
  currency: 'USD';
  purpose?: string;
  authorizedItems: AuthorizedExpenseItem[];
}

export type ExpenseCategory = 'airfare' | 'lodging' | 'rental_car' | 'fuel' | 'meals' | 'parking' | 'ground_transport' | 'baggage' | 'other';
export type PaymentMethod = 'gtcc' | 'personal';

export interface AuthorizedExpenseItem {
  id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  merchant?: string;
  location?: string;
  expectedPaymentMethod?: PaymentMethod;
  date?: string;
  startDate?: string;
  endDate?: string;
  nights?: number;
}
