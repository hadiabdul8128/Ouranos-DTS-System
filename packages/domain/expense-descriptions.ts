/** Expense type names as they appear in DTS (HQ RIO DTS Quick Guide), so the plan matches what travelers pick in DTS. */
export const dtsExpenseTypes:Record<string,string[]>={
 airfare:['Airline Ticket (Self-Procure)','TMC Fee (IBA)'],
 lodging:['Lodging Tax','Lodging Resort Fees'],
 rental_car:['Rental Car - at TDY Area'],
 fuel:['Rental Car - Fuel/Charging'],
 meals:[],
 parking:['Parking - At The Terminal','Parking - TDY Area'],
 ground_transport:['Private Auto - To/From TDY','TNC Fares (Rideshare) - TDY Area','Taxi - To/From Terminal','Bridge, Road, or Tunnel Tolls'],
 transport:['TNC Fares (Rideshare) - TDY Area','Taxi - To/From Terminal','Bridge, Road, or Tunnel Tolls'],
 baggage:[],
 other:['Cross Border Processing Fee','VAT Form (Exemption Certificate)'],
};
/** Other common descriptions for each expense type, so travelers pick instead of typing. */
export const expenseDescriptions:Record<string,string[]>={
 airfare:['Round-trip flight','Outbound flight','Return flight','Flight change fee'],
 lodging:['Hotel','Government quarters','Extended-stay lodging'],
 rental_car:['Rental car fees'],
 fuel:['Government vehicle fuel'],
 meals:['Meals and incidentals','Per diem meals'],
 parking:['Hotel parking','Event or base parking'],
 ground_transport:['Shuttle','Train or bus'],
 transport:['Shuttle','Train or bus'],
 baggage:['Checked bag','Excess baggage'],
 other:['Registration fee','Laundry','Passport or visa','Internet'],
};
const known=(category:string)=>category in expenseDescriptions?category:'other';
export const dtsOptions=(category:string)=>dtsExpenseTypes[known(category)]!;
export const commonOptions=(category:string)=>expenseDescriptions[known(category)]!;
export const descriptionOptions=(category:string)=>[...dtsOptions(category),...commonOptions(category)];
/** A saved description that is not one of the choices is shown as typed text under Other. */
export const isListedDescription=(category:string,value:string)=>descriptionOptions(category).includes(value);
/** The DTS name used for a driving-your-own-car mileage cost. */
export const MILEAGE_DESCRIPTION='Private Auto - To/From TDY';
