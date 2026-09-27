import {z} from 'zod';

export const hotelPropertySchema=z.tuple([z.string().min(1),z.string().min(1),z.string().min(1),z.string(),z.string(),z.string().min(1)]);
export const hotelCatalogSchema=z.object({source:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.gsa.gov'}),published:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),properties:z.array(hotelPropertySchema).min(1)}).strict();
export type HotelProperty=z.infer<typeof hotelPropertySchema>;
export type HotelCatalog=z.infer<typeof hotelCatalogSchema>;

const states:Record<string,string>={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Puerto Rico':'PR','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
const countryAlias:Record<string,string>={us:'United States',usa:'United States','united states of america':'United States',uk:'United Kingdom',gb:'United Kingdom',uae:'United Arab Emirates'};

export function hotelLocation(property:HotelProperty){const [, ,city,state,,country]=property;return {city,state,country,label:[city,country==='United States'?state:country].filter(Boolean).join(', ')}}
export function hotelAddress(property:HotelProperty){const [,address,city,state,zip,country]=property;return [address,[city,state,zip].filter(Boolean).join(', '),country].filter(Boolean).join(' · ')}
export function hotelMapUrl(property:HotelProperty){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property[0],property[1],property[2],property[3],property[4],property[5]].filter(Boolean).join(', '))}`}
const fold=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const locationKey=(p:HotelProperty)=>[fold(p[2]),fold(p[3]),fold(p[5])].join('|');
const zip=(value:string)=>value.match(/\b\d{5}\b/)?.[0]||'';

export type HotelSearch={status:'empty'|'not_found'|'multiple_locations'|'found';suggestions:{key:string;label:string;count:number}[];total:number;properties:HotelProperty[];location?:string};
export function searchHotels(catalog:HotelCatalog,rawDestination:string,options:{workZip?:string;hotelName?:string;limit?:number}={}):HotelSearch{
 const destination=rawDestination.trim();
 if(!destination)return {status:'empty',suggestions:[],total:0,properties:[]};
 const postal=zip(destination);
 const parts=destination.split(',').map(v=>v.trim()).filter(Boolean);
 const city=fold(parts[0]||'');
 const qualifier=fold(parts.slice(1).join(' ')).replace(/\b\d{5}\b/g,'').trim();
 const state=Object.entries(states).find(([name,code])=>fold(name)===qualifier||code.toLowerCase()===qualifier)?.[0];
 const country=countryAlias[qualifier]||(['united states','united kingdom'].includes(qualifier)?qualifier.replace(/\b\w/g,letter=>letter.toUpperCase()):'');
 const matches=catalog.properties.filter(p=>{
  if(postal)return zip(p[4])===postal;
  if(fold(p[2])!==city)return false;
  if(state)return state==='Puerto Rico'?p[5]==='Puerto Rico':p[5]==='United States'&&fold(p[3])===fold(state);
  if(country)return fold(p[5])===fold(country);
  return !qualifier||fold(p[3])===qualifier||fold(p[5])===qualifier;
 });
 if(!matches.length){
  const locations=new Map<string,{key:string;label:string;count:number}>();
  if(city.length>=3&&!postal)for(const p of catalog.properties){if(!fold(p[2]).startsWith(city))continue;const key=locationKey(p),current=locations.get(key);if(current)current.count++;else locations.set(key,{key,label:hotelLocation(p).label,count:1})}
  return {status:'not_found',suggestions:[...locations.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,8),total:0,properties:[]};
 }
 const locations=new Map<string,{key:string;label:string;count:number}>();
 for(const p of matches){const key=locationKey(p),current=locations.get(key);if(current)current.count++;else locations.set(key,{key,label:hotelLocation(p).label,count:1})}
 if(locations.size>1&&!postal)return {status:'multiple_locations',suggestions:[...locations.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)),total:matches.length,properties:[]};
 const nameFilter=fold(options.hotelName||'');
 const filtered=matches.filter(p=>!nameFilter||fold(`${p[0]} ${p[1]} ${p[4]}`).includes(nameFilter));
 const workZip=zip(options.workZip||'');
 filtered.sort((a,b)=>Number(zip(b[4])===workZip&&!!workZip)-Number(zip(a[4])===workZip&&!!workZip)||a[0].localeCompare(b[0]));
 const limit=Math.max(1,Math.min(options.limit||12,100));
 return {status:'found',suggestions:[],total:filtered.length,properties:filtered.slice(0,limit),location:hotelLocation(matches[0]).label};
}

export function displayState(state:string){return states[state]||state}
export function canonicalLocation(property:HotelProperty){const {city,state,country}=hotelLocation(property);return [city,country==='United States'?displayState(state):country].filter(Boolean).join(', ')}
export function parseHotelCatalog(value:unknown){return hotelCatalogSchema.parse(value)}
