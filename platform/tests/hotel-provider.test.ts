import {describe,expect,it,vi} from 'vitest';
import {hotelOfferRequest,searchBookingOffers} from '../api/hotel-provider';
import {averageNightlyPrice,stayNights} from '../../packages/domain/hotel-price';

const input={latitude:32.716,longitude:-117.161,radiusMiles:10,checkin:'2026-10-12',checkout:'2026-10-15'};
const credentials={apiKey:'test-secret',affiliateId:'test-affiliate',mode:'production' as const};

describe('live hotel provider',()=>{
 it('requires a coherent location and stay date range',()=>{
  expect(hotelOfferRequest.safeParse({...input,latitude:100}).success).toBe(false);
  expect(hotelOfferRequest.safeParse({...input,checkout:'2026-10-11'}).success).toBe(false);
  expect(hotelOfferRequest.safeParse({...input,checkin:'2026-02-30'}).success).toBe(false);
  expect(hotelOfferRequest.parse(input)).toEqual(input);
 });
 it('maps priced offers, real photos and review scores without inventing missing values',async()=>{
  const request=vi.fn(async(url:string,options:RequestInit)=>{
   expect(options.headers).toMatchObject({Authorization:'Bearer test-secret','X-Affiliate-Id':'test-affiliate'});
   if(url.endsWith('/search')){
    expect(JSON.parse(String(options.body))).toMatchObject({checkin:'2026-10-12',coordinates:{latitude:32.716,longitude:-117.161}});
    return new Response(JSON.stringify({data:[
     {id:4,currency:{booker:'USD'},price:{total:{booker_currency:621}},deep_link_url:'booking://hotel/4',url:'https://www.booking.com/hotel/us/marriott.html'},
     {id:5,currency:{booker:'USD'},price:{total:{booker_currency:0}},url:'https://www.booking.com/hotel/us/invalid.html'},
     {id:6,currency:{booker:'USD'},price:{total:{booker_currency:280}},url:'https://malicious.example/offer'},
    ]}),{status:200});
   }
   expect(JSON.parse(String(options.body)).accommodations).toEqual([4,6]);
   return new Response(JSON.stringify({data:[
    {id:4,name:{'en-us':'Marriott San Diego'},location:{address:{'en-us':'123 Main St'}},rating:{review_score:8.7,number_of_reviews:902,stars:4},photos:[{main_photo:true,url:{standard:'https://q-xx.bstatic.com/hotel.jpg'}}]},
    {id:6,name:{'en-us':'Other Hotel'},rating:{review_score:null},photos:[]},
   ]}),{status:200});
  });
  const offers=await searchBookingOffers(input,credentials,request as typeof fetch);
  expect(offers).toEqual([{id:4,name:'Marriott San Diego',address:'123 Main St',photoUrl:'https://q-xx.bstatic.com/hotel.jpg',reviewScore:8.7,reviewCount:902,stars:4,totalPrice:621,currency:'USD',url:'https://www.booking.com/hotel/us/marriott.html'}]);
  expect(request).toHaveBeenCalledTimes(2);
 });
 it('does not call details when no result includes a valid paid total',async()=>{
  const request=vi.fn(async()=>new Response(JSON.stringify({data:[{id:4,currency:{booker:'USD'},price:{total:{booker_currency:0}}}]}),{status:200}));
  expect(await searchBookingOffers(input,credentials,request as typeof fetch)).toEqual([]);
 expect(request).toHaveBeenCalledTimes(1);
 });
 it('labels a three-night total as an average rather than an actual nightly tariff',()=>{
  expect(stayNights('2026-10-12','2026-10-15')).toBe(3);
  expect(averageNightlyPrice(621,'2026-10-12','2026-10-15')).toBe(207);
  expect(averageNightlyPrice(621,'2026-10-15','2026-10-12')).toBeNull();
 });
});
