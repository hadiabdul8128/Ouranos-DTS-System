export const trip = {
  id: 'TDY-2026-0915',
  traveler: 'Alex Morgan',
  destination: 'Washington, DC',
  origin: 'Norfolk, VA',
  startDate: '2026-09-15',
  endDate: '2026-09-19',
  purpose: 'Program review',
  authorizationStatus: 'Approved',
  authorizationId: 'AUTH-2026-1042',
  currency: 'USD',
  authorizedItems: [
    { id: 'air-out', category: 'airfare', label: 'Outbound flight', amount: 380 },
    { id: 'hotel', category: 'lodging', label: 'Hotel · 3 nights at $190', amount: 570, nights: 3, startDate: '2026-09-15', endDate: '2026-09-18' },
    { id: 'rental', category: 'rental_car', label: 'Rental car', amount: 284 },
    { id: 'fuel', category: 'fuel', label: 'Rental car fuel', amount: 55 },
    { id: 'meals', category: 'meals', label: 'Meals & incidentals', amount: 240 },
    { id: 'parking', category: 'parking', label: 'Parking', amount: 92 },
    { id: 'air-return', category: 'airfare', label: 'Return flight', amount: 415, date: '2026-09-19' },
    { id: 'taxi', category: 'ground_transport', label: 'Ground transport', amount: 48 },
    { id: 'baggage', category: 'baggage', label: 'Baggage', amount: 35 }
  ]
};

export const seedExpenses = [
  { id: 'exp-1', tripId: trip.id, date: '2026-09-15', merchant: 'American Airlines', amount: 380, currency: 'USD', category: 'airfare', paymentMethod: 'gtcc', receipt: { name: 'outbound-flight.pdf', demo: true }, authorizationItemId: 'air-out' },
  { id: 'exp-2', tripId: trip.id, date: '2026-09-18', merchant: 'Capital Square Hotel', amount: 621, currency: 'USD', category: 'lodging', paymentMethod: 'gtcc', receipt: { name: 'hotel-folio.pdf', demo: true }, authorizationItemId: 'hotel', serviceStartDate: '2026-09-15', serviceEndDate: '2026-09-18' },
  { id: 'exp-3', tripId: trip.id, date: '2026-09-18', merchant: 'Enterprise', amount: 284, currency: 'USD', category: 'rental_car', paymentMethod: 'gtcc', receipt: { name: 'rental-receipt.pdf', demo: true }, authorizationItemId: 'rental' },
  { id: 'exp-4', tripId: trip.id, date: '2026-09-17', merchant: 'Shell', amount: 55, currency: 'USD', category: 'fuel', paymentMethod: 'gtcc', receipt: { name: 'fuel-receipt.jpg', demo: true }, authorizationItemId: 'fuel' },
  { id: 'exp-5', tripId: trip.id, date: '2026-09-18', merchant: 'Meals & incidentals', amount: 210, currency: 'USD', category: 'meals', paymentMethod: 'personal', receipt: null, authorizationItemId: 'meals' },
  { id: 'exp-6', tripId: trip.id, date: '2026-09-17', merchant: 'Union Station Parking', amount: 92, currency: 'USD', category: 'parking', paymentMethod: 'personal', receipt: null, authorizationItemId: 'parking' },
  { id: 'exp-7', tripId: trip.id, date: '2026-09-20', merchant: 'American Airlines', amount: 415, currency: 'USD', category: 'airfare', paymentMethod: 'gtcc', receipt: { name: 'return-flight.pdf', demo: true }, authorizationItemId: 'air-return' },
  { id: 'exp-8', tripId: trip.id, date: '2026-09-16', merchant: 'Yellow Cab', amount: 48, currency: 'USD', category: 'ground_transport', paymentMethod: 'personal', receipt: { name: 'taxi-receipt.jpg', demo: true }, authorizationItemId: 'taxi' },
  { id: 'exp-9', tripId: trip.id, date: '2026-09-15', merchant: 'American Airlines', amount: 35, currency: 'USD', category: 'baggage', paymentMethod: 'personal', receipt: { name: 'baggage-receipt.pdf', demo: true }, authorizationItemId: 'baggage' }
];

export const categoryLabels = {
  airfare: 'Airfare', lodging: 'Lodging', rental_car: 'Rental car', fuel: 'Fuel',
  meals: 'Meals & incidentals', parking: 'Parking', ground_transport: 'Ground transport', baggage: 'Baggage', other: 'Other'
};
