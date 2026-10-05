/** Rental car counters near a trip destination, from the companies' own locators. Locations only: no prices or availability. */
export type RentalPlace=[name:string,state:string,lat:number,lon:number];
export type RentalCounter=[company:string,branch:string,address:string,lat:number,lon:number,airport:0|1,phone:string,website:string];
export type RentalCatalog={source:string;retrieved:string;places:RentalPlace[];counters:RentalCounter[]};
export type RentalLocation={id:string;company:string;branch:string;address:string;lat:number;lon:number;distanceKm:number;airport:boolean;phone:string;website:string};
export type RentalSearch={status:'found';place:string;locations:RentalLocation[]}|{status:'no-place'}|{status:'none-near';place:string};

/** Counters farther than this from the destination aren't worth listing. */
export const RENTAL_MAX_KM=80;

export function parseRentalCatalog(value:unknown):RentalCatalog{
 const v=value as Partial<RentalCatalog>|null;
 if(!v||typeof v.source!=='string'||!Array.isArray(v.places)||!Array.isArray(v.counters))throw new Error('The rental car list is not in the expected format.');
 return v as RentalCatalog;
}

export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const rad=(deg:number)=>deg*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(h));
}

/** 'St. Louis' and 'Saint Louis', 'Ft Worth' and 'Fort Worth' compare equal. */
const normalize=(name:string)=>name.toLowerCase().replace(/[.']/g,'').replace(/\bsaint\b/g,'st').replace(/\bfort\b/g,'ft').replace(/\bmount\b/g,'mt').replace(/[^a-z0-9]+/g,' ').trim();

/** Finds a trip destination such as 'Seattle, WA' in the Census places list. */
export function findPlace(catalog:RentalCatalog,destination:string){
 const match=destination.match(/^\s*(.+?)\s*,\s*([A-Za-z]{2})\b/);
 if(!match)return null;
 const name=normalize(match[1]!),state=match[2]!.toUpperCase();
 const place=catalog.places.find(p=>p[1]===state&&normalize(p[0])===name);
 return place?{name:`${place[0]}, ${place[1]}`,lat:place[2],lon:place[3]}:null;
}

/** The rental counters nearest the destination, closest first. */
export function searchRentalCounters(catalog:RentalCatalog,destination:string,maxKm=RENTAL_MAX_KM):RentalSearch{
 const place=findPlace(catalog,destination);
 if(!place)return {status:'no-place'};
 const locations=catalog.counters.flatMap((c,index):RentalLocation[]=>{
  const distance=distanceKm(place,{lat:c[3],lon:c[4]});
  return distance>maxKm?[]:[{id:`${index}`,company:c[0],branch:c[1],address:c[2],lat:c[3],lon:c[4],distanceKm:distance,airport:c[5]===1,phone:c[6],website:c[7]}];
 }).sort((a,b)=>a.distanceKm-b.distanceKm);
 return locations.length?{status:'found',place:place.name,locations}:{status:'none-near',place:place.name};
}

/** With a street address the map finds the counter by name; without one it drops a pin on the spot. */
export const rentalMapUrl=(location:RentalLocation)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address?`${location.company}, ${location.address}`:`${location.lat},${location.lon}`)}`;
export const milesFromKm=(km:number)=>km*0.621371;
