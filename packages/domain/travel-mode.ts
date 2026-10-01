/** How the traveler gets to the destination; only flying uses flight suggestions. */
export const travelModes=['air','pov','rental','government','other'] as const;
export type TravelMode=typeof travelModes[number];
export const travelModeNames:Record<TravelMode,string>={air:'Flying',pov:'Driving my own car',rental:'Rental car',government:'Government vehicle',other:'Other (train, bus, ride)'};
export const travelModeHints:Record<TravelMode,string>={
 air:'Pick a flight below for a cost estimate.',
 pov:'Enter the round-trip miles to estimate mileage. Check the current mileage rate with your travel office.',
 rental:'Add a rental car line and a fuel line to your costs.',
 government:'No transportation cost to add; fuel and the vehicle are covered.',
 other:'Add the ticket or fare as a cost below.',
};

/** Mileage in cents, rounded once: miles × rate in cents per mile. */
export function mileageMinor(miles:number,centsPerMile:number){
 if(!Number.isFinite(miles)||miles<=0||!Number.isFinite(centsPerMile)||centsPerMile<=0)return null;
 return Math.round(miles*centsPerMile);
}

/** "Driving my own car · 420 miles at $0.70/mile", or just the mode. */
export function travelModeSummary(mode:TravelMode|undefined,mileage?:{miles:number;centsPerMile:number}){
 if(!mode)return 'Not given';
 return mode==='pov'&&mileage?`${travelModeNames.pov} · ${mileage.miles} miles at $${(mileage.centsPerMile/100).toFixed(2)}/mile`:travelModeNames[mode];
}
