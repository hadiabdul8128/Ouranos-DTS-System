import type {FastifyInstance} from 'fastify';
import type {PlatformConfig} from '../shared/config';
import {hotelOfferRequest,searchBookingOffers} from './hotel-provider';

export function registerHotelRoutes(app:FastifyInstance,config:PlatformConfig){
 app.post('/v1/hotels/search',{config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async(req,reply)=>{
  const input=hotelOfferRequest.parse(req.body);
  if(!config.BOOKING_DEMAND_API_KEY||!config.BOOKING_DEMAND_AFFILIATE_ID)return {status:'unavailable',source:null,offers:[]};
  try{
   const offers=await searchBookingOffers(input,{apiKey:config.BOOKING_DEMAND_API_KEY,affiliateId:config.BOOKING_DEMAND_AFFILIATE_ID,mode:config.BOOKING_DEMAND_MODE});
   return {status:'results',source:config.BOOKING_DEMAND_MODE==='sandbox'?'booking.com sandbox':'booking.com',offers};
  }catch(error){
   app.log.warn({errorType:error instanceof Error?error.name:'unknown'},'Hotel provider unavailable');
   return reply.code(503).send({error:{code:'PROVIDER_UNAVAILABLE',message:'Live hotel offers are temporarily unavailable. Try again later.',requestId:req.id}});
  }
 });
}
