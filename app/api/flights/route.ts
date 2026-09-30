import {flightQuerySchema,searchFlights} from '../../../packages/domain/flight-search';

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const query=flightQuerySchema.safeParse({from:params.get('from')??'',to:params.get('to')??'',departure:params.get('departure')??'',...(params.get('returnDate')?{returnDate:params.get('returnDate')}:{})});
 if(!query.success)return Response.json({error:'Enter where you are flying from, where to, and a departure date.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await searchFlights(query.data),{headers:{'Cache-Control':'private, max-age=600'}})}
 catch{return Response.json({error:'Flight prices are unavailable right now. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
