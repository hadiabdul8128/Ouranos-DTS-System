import {Suspense} from 'react';
import {MeetingsWorkspace} from '@/components/meetings/meetings-workspace';
export default function MeetingsPage(){return <Suspense fallback={<main className="quiet-page"><p role="status">Opening meetings…</p></main>}><MeetingsWorkspace/></Suspense>}
