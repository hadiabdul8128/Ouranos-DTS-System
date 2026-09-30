import {z} from 'zod';

const place=z.string().trim().min(2).max(120);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const flightQuerySchema=z.object({from:place,to:place,departure:day,returnDate:day.optional()}).strict().refine(v=>!v.returnDate||v.returnDate>=v.departure,{path:['returnDate'],message:'Return must be on or after departure'});
export type FlightQuery=z.infer<typeof flightQuerySchema>;
export type FlightOption={price:number;roundTrip:boolean;airline:string;stops:number;departAirport:string;departTime:string;arriveAirport:string;arriveTime:string;duration:string};
export type FlightResults={source:'Google Flights';searchUrl:string;fetchedAt:string;options:FlightOption[]};

export function flightSearchUrl(query:FlightQuery){
 const trip=query.returnDate?`on ${query.departure} through ${query.returnDate}`:`on ${query.departure} one way`;
 const q=`Flights to ${query.to} from ${query.from} ${trip}`;
 return `https://www.google.com/travel/flights?${new URLSearchParams({q,hl:'en',gl:'us',curr:'USD'})}`;
}
