/** Authorization -> Voucher handoff. Dates use YYYY-MM-DD; amounts are USD numbers. */
export interface TravelAuthorization {
  tripId: string;
  authorizationId: string;
  status: 'Approved';
  traveler: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  currency: 'USD';
  purpose?: string;
  approvedExpenseItems: ApprovedExpenseItem[];
}

export type ExpenseCategory = 'airfare' | 'lodging' | 'rental_car' | 'fuel' | 'meals' | 'parking' | 'ground_transport' | 'baggage' | 'other';
export type PaymentMethod = 'gtcc' | 'personal';

export interface ApprovedExpenseItem {
  id: string;
  category: ExpenseCategory;
  description: string;
  authorizedAmount: number;
  merchant?: string;
  location?: string;
  expectedPaymentMethod?: PaymentMethod;
  date?: string;
  startDate?: string;
  endDate?: string;
  nights?: number;
}

/** Internal aliases keep the existing Voucher rules and JSON imports compatible. */
export interface NormalizedTravelAuthorization extends TravelAuthorization {
  id: string;
  startDate: string;
  endDate: string;
  authorizationStatus: 'Approved';
  authorizedItems: (ApprovedExpenseItem & { label: string; amount: number })[];
}
