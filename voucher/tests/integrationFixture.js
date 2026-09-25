/** Test-only trip. Nothing here is imported by the production UI. */
export const authorization = {
  tripId: 'TDY-RALEIGH-SD-2026', authorizationId: 'AUTH-2026-1042', status: 'Approved',
  traveler: 'Alex Morgan', origin: 'Raleigh, NC', destination: 'San Diego, CA',
  departureDate: '2026-10-12', returnDate: '2026-10-15', currency: 'USD', purpose: 'Four-day training visit',
  approvedExpenseItems: [
    { id: 'flight-out', category: 'airfare', description: 'Outbound flight', authorizedAmount: 620, merchant: 'American Airlines', date: '2026-10-12', expectedPaymentMethod: 'gtcc' },
    { id: 'hotel', category: 'lodging', description: 'Marriott lodging · $190/night', authorizedAmount: 570, merchant: 'Marriott', location: 'San Diego, CA', startDate: '2026-10-12', endDate: '2026-10-15', nights: 3, expectedPaymentMethod: 'gtcc' },
    { id: 'rental', category: 'rental_car', description: 'Rental car', authorizedAmount: 280, merchant: 'Hertz', expectedPaymentMethod: 'gtcc' },
    { id: 'parking', category: 'parking', description: 'Parking', authorizedAmount: 75, location: 'San Diego, CA', expectedPaymentMethod: 'personal' },
    { id: 'flight-return', category: 'airfare', description: 'Return flight home', authorizedAmount: 310, merchant: 'American Airlines', date: '2026-10-15', expectedPaymentMethod: 'gtcc' }
  ]
};

export const receipts = {
  outbound: 'American Airlines\nDate Oct 12 2026\nOutbound flight\nTotal paid $620.00\nGovernment Travel Card',
  hotel: 'Marriott San Diego\n123 Harbor Ave\nSan Diego, CA 92101\nCheck-in 10/12/2026\nCheck-out 10/15/2026\nDate 10/15/2026\nSubtotal $570.00\nOccupancy Tax $51.00\nTotal paid $621.00\nGovernment Travel Card',
  rental: 'Hertz Rent A Car\nDate Oct 15 2026\nRental car\nTotal paid $280.00\nGovernment Travel Card',
  parking: 'Harbor Parking Garage\nDate Oct 13 2026\nTotal paid $75.00\nPersonal card',
  return: 'American Airlines\nDate Oct 16 2026\nReturn flight home\nTotal paid $310.00\nGovernment Travel Card'
};
