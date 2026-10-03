import {ArrowUpRight} from 'lucide-react';

const preferred='https://www.travel.dod.mil/Programs/Lodging/DoD-Preferred-Commercial-Lodging/Resources/';
const fedrooms='https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms';

export function HotelBookingGuidance(){return <aside className="hotel-guidance" aria-labelledby="hotel-booking-title">
 <div><h2 id="hotel-booking-title">Check the lodging rules first</h2><p>TDY at a military installation may require adequate DoD lodging first. At an Integrated Lodging Program location, DoD, privatized, or DoD Preferred lodging can take priority over the FedRooms candidates below.</p><p>The GSA list shows real participating hotels, but not availability, your government rate or taxes. Confirm those with the hotel or your travel office.</p></div>
 <div className="hotel-guidance-links"><a href={preferred} target="_blank" rel="noopener noreferrer">Check DoD Preferred lodging <ArrowUpRight size={15}/></a><a href={fedrooms} target="_blank" rel="noopener noreferrer">About FedRooms <ArrowUpRight size={15}/></a></div>
 </aside>}
