import {z} from 'zod';
import {displayState,hotelLocation,searchHotels,type HotelCatalog,type HotelProperty} from './hotel-discovery';

const point=z.tuple([z.number().min(-90).max(90),z.number().min(-180).max(180)]);
export const postalCentersSchema=z.object({source:z.literal('https://download.geonames.org/export/zip/US.zip'),license:z.literal('CC BY 4.0'),retrieved:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),points:z.record(z.string().regex(/^\d{5}$/),point),cities:z.record(z.string(),z.tuple([z.number().min(-90).max(90),z.number().min(-180).max(180),z.string().min(1),z.string().min(1)]))}).strict();
export type PostalCenters=z.infer<typeof postalCentersSchema>;
export type NearbyHotel={property:HotelProperty;distanceMiles:number|null};
export type NearbySearch={status:'empty'|'not_found'|'multiple_locations'|'found';suggestions:{key:string;label:string;count:number}[];location:string;center:[number,number]|null;total:number;hotels:NearbyHotel[];radiusApplied:boolean};

const deg=Math.PI/180;
export function milesBetween(a:readonly [number,number],b:readonly [number,number]){
 const deltaLat=(b[0]-a[0])*deg,deltaLon=(b[1]-a[1])*deg;
 const value=Math.sin(deltaLat/2)**2+Math.cos(a[0]*deg)*Math.cos(b[0]*deg)*Math.sin(deltaLon/2)**2;
 return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(value)));
}
function median(values:number[]){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]}
const postal=(value:string)=>/^\d{5}$/.test(value.trim())?value.trim():null;
const fold=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function matchCity(centers:PostalCenters,location:string){
 const [rawCity,rawState]=location.split(',').map(value=>value.trim());
 const city=fold(rawCity||''),state=fold(displayState(rawState||''));
 if(!city)return [];
 return Object.entries(centers.cities||{}).filter(([key])=>{const [name,code]=key.split('|');return name===city&&(!state||code===state)}).map(([key,value])=>({key,value}));
}

export function findNearbyHotels(catalog:HotelCatalog,centers:PostalCenters,rawLocation:string,options:{radiusMiles?:number;workZip?:string;hotelName?:string;limit?:number}={}):NearbySearch{
 const location=rawLocation.trim(),empty:{suggestions:NearbySearch['suggestions'];location:string;center:null;total:number;hotels:NearbyHotel[];radiusApplied:boolean}={suggestions:[],location:'',center:null,total:0,hotels:[],radiusApplied:false};
 if(!location)return {status:'empty',...empty};
 const zip=postal(location),workZip=postal(options.workZip||'');
 const seed=zip?null:searchHotels(catalog,location,{limit:100});
 if(seed?.status==='multiple_locations')return {status:seed.status,suggestions:seed.suggestions,location:'',center:null,total:0,hotels:[],radiusApplied:false};
 const geoCities=seed?.status==='not_found'?matchCity(centers,location):[];
 if(geoCities.length>1)return {status:'multiple_locations',suggestions:geoCities.slice(0,12).map(({key,value})=>({key,label:`${value[2]}, ${value[3]}`,count:0})),location:'',center:null,total:0,hotels:[],radiusApplied:false};
 if(seed?.status==='not_found'&&!geoCities.length)return {status:'not_found',suggestions:seed.suggestions,location:'',center:null,total:0,hotels:[],radiusApplied:false};
 const geoCity=geoCities[0]?.value;
 const seedProperties=seed?.status==='found'?seed.properties:[];
 const isUnitedStates=zip||Boolean(geoCity)||seedProperties.some(property=>property[5]==='United States');
 const points=seedProperties.filter(property=>property[5]==='United States').map(property=>centers.points[property[4].slice(0,5)]).filter((value):value is [number,number]=>Boolean(value));
 const baseCenter=zip?centers.points[zip]:geoCity?[geoCity[0],geoCity[1]] as [number,number]:points.length?[median(points.map(value=>value[0])),median(points.map(value=>value[1]))] as [number,number]:null;
 const center=workZip&&centers.points[workZip]&&isUnitedStates?centers.points[workZip]:baseCenter;
 if(zip&&!center)return {status:'not_found',...empty};
 const radius=Math.max(1,Math.min(options.radiusMiles||10,50));
 const name=(options.hotelName||'').trim().toLocaleLowerCase('en-US');
 const limit=Math.max(1,Math.min(options.limit||12,100));
 const candidates:NearbyHotel[]=center?catalog.properties.filter(property=>property[5]==='United States').flatMap(property=>{
  const point=centers.points[property[4].slice(0,5)];
  if(!point)return [];
  const distance=milesBetween(center,point);
  return distance<=radius?[{property,distanceMiles:distance}]:[];
 }):seedProperties.map(property=>({property,distanceMiles:null}));
 const hotels=candidates.filter(({property})=>!name||property[0].toLocaleLowerCase('en-US').includes(name))
  .sort((a,b)=>(a.distanceMiles??Infinity)-(b.distanceMiles??Infinity)||a.property[0].localeCompare(b.property[0]));
 const resolvedLocation=zip?`ZIP ${zip}`:geoCity?`${geoCity[2]}, ${geoCity[3]}`:seedProperties.length?hotelLocation(seedProperties[0]).label:location;
 return {status:'found',suggestions:[],location:workZip&&center?`work ZIP ${workZip}`:resolvedLocation,center:center||null,total:hotels.length,hotels:hotels.slice(0,limit),radiusApplied:Boolean(center)};
}
