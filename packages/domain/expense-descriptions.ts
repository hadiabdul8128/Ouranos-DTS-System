/** Common descriptions for each expense type, so travelers pick instead of typing. */
export const expenseDescriptions:Record<string,string[]>={
 airfare:['Round-trip flight','Outbound flight','Return flight','Flight change fee'],
 lodging:['Hotel','Government quarters','Extended-stay lodging','Lodging taxes'],
 rental_car:['Rental car','Rental car fees'],
 fuel:['Rental car fuel','Government vehicle fuel'],
 meals:['Meals and incidentals','Per diem meals'],
 parking:['Airport parking','Hotel parking','Event or base parking'],
 ground_transport:['Mileage, own car','Taxi or rideshare','Shuttle','Train or bus','Tolls'],
 transport:['Taxi or rideshare','Shuttle','Train or bus','Tolls'],
 baggage:['Checked bag','Excess baggage'],
 other:['Registration fee','Laundry','Passport or visa','Internet'],
};
export const descriptionOptions=(category:string)=>expenseDescriptions[category]??expenseDescriptions.other!;
/** A saved description that is not one of the choices is shown as typed text under Other. */
export const isListedDescription=(category:string,value:string)=>descriptionOptions(category).includes(value);
