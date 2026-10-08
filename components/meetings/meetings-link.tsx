import Link from 'next/link';
import {Video} from 'lucide-react';
import './meetings-link.css';
export function MeetingsLink(){return <Link href="/dashboard/meetings" className="exit-link home-meetings-link" aria-label="Meetings" title="Meetings"><Video size={16} aria-hidden="true"/><span>Meetings</span></Link>}
