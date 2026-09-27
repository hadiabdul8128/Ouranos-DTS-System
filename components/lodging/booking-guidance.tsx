import {ArrowUpRight} from 'lucide-react';

const dts='https://dtsproweb.defensetravel.osd.mil/dts-app/pubsite/all/view';
const preferred='https://www.travel.dod.mil/Programs/Lodging/DoD-Preferred-Commercial-Lodging/Resources/';
const fedrooms='https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms';

export function HotelBookingGuidance(){return <aside className="hotel-guidance" aria-labelledby="hotel-booking-title">
 <div><h2 id="hotel-booking-title">Check the required lodging order in DTS</h2><p>DTS shows the lodging options that apply to your trip. TDY at a military installation may require adequate DoD lodging first. At an Integrated Lodging Program location, DoD, privatized, or DoD Preferred lodging can take priority over the FedRooms candidates below.</p><p>The GSA list identifies real participating properties, but it does not show availability, your government rate, taxes, or whether an option is currently offered in DTS.</p></div>
 <div className="hotel-guidance-links"><a className="hotel-primary-link" href={dts} target="_blank" rel="noopener noreferrer">Open DTS to book <ArrowUpRight size={16}/></a><a href={preferred} target="_blank" rel="noopener noreferrer">Check DoD Preferred lodging <ArrowUpRight size={15}/></a><a href={fedrooms} target="_blank" rel="noopener noreferrer">About FedRooms <ArrowUpRight size={15}/></a></div>
 </aside>}
