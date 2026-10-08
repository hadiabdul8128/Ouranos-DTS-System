'use client';
import {useState} from 'react';
import {LiveKitRoom,PreJoin,VideoConference,type LocalUserChoices} from '@livekit/components-react';
import '@livekit/components-styles';
import type {MeetingConnection} from '@/packages/contracts/meetings';
export default function CallRoom({name,getConnection,onLeave}:{name:string;getConnection:()=>Promise<MeetingConnection>;onLeave:()=>void}){
 const [choices,setChoices]=useState<LocalUserChoices|null>(null),[connection,setConnection]=useState<MeetingConnection|null>(null),[error,setError]=useState(''),[joining,setJoining]=useState(false);
 async function join(value:LocalUserChoices){
  if(joining)return;setJoining(true);setError('');
  try{const c=await getConnection();setChoices(value);setConnection(c)}catch(cause){setError(cause instanceof Error?cause.message:'Unable to join the call')}finally{setJoining(false)}
 }
 return <div className="meeting-call" data-lk-theme="default">
  {connection&&choices?<LiveKitRoom token={connection.token} serverUrl={connection.serverUrl} connect audio={choices.audioEnabled?{deviceId:choices.audioDeviceId}:false} video={choices.videoEnabled?{deviceId:choices.videoDeviceId}:false} onDisconnected={onLeave} onError={e=>setError(e.message)} onMediaDeviceFailure={()=>setError('A device is unavailable. Check your browser permissions and device selection.')}><VideoConference/></LiveKitRoom>:<div className="meeting-prejoin"><PreJoin defaults={{username:name,audioEnabled:false,videoEnabled:false}} onSubmit={join} onError={e=>setError(e.message)} joinLabel={joining?'Joining…':'Join meeting'} persistUserChoices={false}/><button type="button" className="meeting-back" onClick={onLeave}>Back to meetings</button></div>}
  {error&&<p className="meeting-error" role="alert">{error}</p>}
 </div>;
}
