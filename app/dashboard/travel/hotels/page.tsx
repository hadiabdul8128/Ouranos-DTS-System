import {HotelFinder} from '@/components/lodging/hotel-finder';
import './hotels.css';

export default async function HotelsPage({searchParams}:{searchParams:Promise<{tripId?:string}>}){
 const {tripId}=await searchParams;
 return <HotelFinder tripId={tripId||''}/>;
}
