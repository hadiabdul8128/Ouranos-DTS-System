import {z} from 'zod';
import {stayNights} from '../../packages/domain/hotel-price';

export const hotelOfferRequest=z.object({
 latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),
 radiusMiles:z.number().min(1).max(50),
 checkin:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),checkout:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict().refine(value=>stayNights(value.checkin,value.checkout)>0,{message:'Check-out must follow a valid check-in date',path:['checkout']});
export type HotelOfferRequest=z.infer<typeof hotelOfferRequest>;
export type HotelOffer={id:number;name:string;address:string;photoUrl:string|null;reviewScore:number|null;reviewCount:number|null;stars:number|null;totalPrice:number;currency:string;url:string};
export type HotelOfferResponse={status:'unavailable'|'results';source:'booking.com'|'booking.com sandbox'|null;offers:HotelOffer[]};

const money=z.number().finite();
const searchResponse=z.object({data:z.array(z.object({
 id:z.number().int(),currency:z.object({booker:z.string()}).optional(),
 price:z.object({total:z.object({booker_currency:money.optional()}).optional()}).optional(),
 url:z.string().optional(),deep_link_url:z.string().optional(),
}).passthrough())}).passthrough();
const detailsResponse=z.object({data:z.array(z.object({
 id:z.number().int(),name:z.record(z.string().nullable()).optional(),
 location:z.object({address:z.record(z.string().nullable()).optional()}).optional(),
 rating:z.object({review_score:z.number().nullable().optional(),number_of_reviews:z.number().nullable().optional(),stars:z.number().nullable().optional()}).optional(),
 photos:z.array(z.object({main_photo:z.boolean().optional(),url:z.object({standard:z.string().optional(),thumbnail_large:z.string().optional()}).optional()})).optional(),
}).passthrough())}).passthrough();

function localized(value:Record<string,string|null>|undefined){return value?.['en-us']||value?.['en-gb']||Object.values(value||{}).find(text=>Boolean(text))||''}
function approvedUrl(value:string|undefined,host:string){
 if(!value)return '';
 try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname===host||url.hostname.endsWith(`.${host}`))?url.href:''}catch{return ''}
}

export async function searchBookingOffers(input:HotelOfferRequest,credentials:{apiKey:string;affiliateId:string;mode:'production'|'sandbox'},request:typeof fetch=fetch):Promise<HotelOffer[]>{
 const base=credentials.mode==='sandbox'?'https://demandapi-sandbox.booking.com/3.2':'https://demandapi.booking.com/3.2';
 const headers={'Content-Type':'application/json','Authorization':`Bearer ${credentials.apiKey}`,'X-Affiliate-Id':credentials.affiliateId};
 async function post(path:string,body:unknown){
  const response=await request(`${base}${path}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Hotel provider returned ${response.status}`);
  return response.json();
 }
 const search=searchResponse.parse(await post('/accommodations/search',{
  booker:{country:'us',platform:'desktop'},checkin:input.checkin,checkout:input.checkout,
  coordinates:{latitude:input.latitude,longitude:input.longitude,radius:Math.round(input.radiusMiles*1.609344*10)/10},
  currency:'USD',guests:{number_of_adults:1,number_of_rooms:1},rows:20,
 }));
 const priced=search.data.filter(item=>(item.price?.total?.booker_currency||0)>0&&/^[A-Z]{3}$/.test(item.currency?.booker||'')).slice(0,20);
 if(!priced.length)return [];
 const details=detailsResponse.parse(await post('/accommodations/details',{accommodations:priced.map(item=>item.id),extras:['photos'],languages:['en-us']}));
 const byId=new Map(details.data.map(item=>[item.id,item]));
 return priced.flatMap(item=>{
  const detail=byId.get(item.id),name=localized(detail?.name),url=approvedUrl(item.deep_link_url,'booking.com')||approvedUrl(item.url,'booking.com');
  const totalPrice=item.price?.total?.booker_currency,currency=item.currency?.booker;
  if(!detail||!name||!url||!totalPrice||!currency)return [];
  const photo=detail.photos?.find(photo=>photo.main_photo)||detail.photos?.[0];
  const photoUrl=approvedUrl(photo?.url?.standard||photo?.url?.thumbnail_large,'bstatic.com')||null;
  const score=detail.rating?.review_score,count=detail.rating?.number_of_reviews,stars=detail.rating?.stars;
  return [{id:item.id,name,address:localized(detail.location?.address),photoUrl,
   reviewScore:score!==null&&score!==undefined&&score>=0&&score<=10?score:null,
   reviewCount:count!==null&&count!==undefined&&count>=0?count:null,
   stars:stars!==null&&stars!==undefined&&stars>=1&&stars<=5?stars:null,
   totalPrice,currency,url}];
 });
}
