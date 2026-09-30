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

const entities:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
function decode(value:string){
 return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(match,code:string)=>code[0]==='#'?String.fromCodePoint(code[1]==='x'||code[1]==='X'?parseInt(code.slice(2),16):Number(code.slice(1))):entities[code.toLowerCase()]??match).replace(/[  ]/g,' ').replace(/\s+/g,' ').trim();
}

// Google Flights renders each result with a full sentence aria-label; it is far
// more stable than its generated class names.
const resultPattern=/^From ([\d,]+) US dollars( round trip total)?\. (Nonstop|(\d+) stops?) flight with (.+?)\.(?: Operated by .+?\.)? Leaves (.+?) at (\d{1,2}:\d{2} [AP]M) on .+? and arrives at (.+?) at (\d{1,2}:\d{2} [AP]M) on .+?\. Total duration (.+?)\./;

/** Results in Google's own order, which puts its "best" flights first. */
export function parseFlightOptions(html:string):FlightOption[]{
 const seen=new Set<string>(),options:FlightOption[]=[];
 for(const [,raw] of html.matchAll(/aria-label="(From [^"]{20,1200}?Select flight)"/g)){
  const match=resultPattern.exec(decode(raw!));if(!match)continue;
  const [,price,round,stopText,stopCount,airline,departAirport,departTime,arriveAirport,arriveTime,duration]=match;
  const option:FlightOption={price:Number(price!.replace(/,/g,'')),roundTrip:Boolean(round),airline:airline!,stops:stopText==='Nonstop'?0:Number(stopCount),departAirport:departAirport!,departTime:departTime!,arriveAirport:arriveAirport!,arriveTime:arriveTime!,duration:duration!};
  const key=`${option.airline}|${option.departTime}|${option.arriveTime}|${option.price}`;
  if(!Number.isFinite(option.price)||option.price<=0||seen.has(key))continue;
  seen.add(key);options.push(option);
 }
 return options;
}

export async function searchFlights(input:FlightQuery,fetcher:typeof fetch=fetch,now=new Date()):Promise<FlightResults>{
 const query=flightQuerySchema.parse(input),searchUrl=flightSearchUrl(query);
 const response=await fetcher(searchUrl,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9',Accept:'text/html'}});
 if(!response.ok)throw new Error('Flight search is unavailable.');
 return {source:'Google Flights',searchUrl,fetchedAt:now.toISOString(),options:parseFlightOptions(await response.text()).slice(0,8)};
}

export function cheapestFlight(options:FlightOption[]){return options.reduce<FlightOption|null>((best,option)=>!best||option.price<best.price?option:best,null)}
