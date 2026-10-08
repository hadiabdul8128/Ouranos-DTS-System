'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePlatform} from '@/components/platform/provider';
import {meetingInput,type Meeting,type MeetingInput,type MeetingsResponse,type MeetingConnection} from '@/packages/contracts/meetings';
const PREVIEW_ORG='00000000-0000-4000-8000-000000000001';
const PREVIEW_USER='00000000-0000-4000-8000-000000000002';
export function useMeetings(){
 const p=usePlatform(),organizationId=p.organizationId||PREVIEW_ORG,userId=p.session?.user.id||PREVIEW_USER;
 const scope=`${organizationId}:${userId}`,cacheKey=`ouranos.meetings.preview.${scope}`,scopeRef=useRef(scope);
 useEffect(()=>{scopeRef.current=scope;return()=>{scopeRef.current=''}},[scope]);
 const [snapshot,setSnapshot]=useState<{scope:string;meetings:Meeting[];callingEnabled:boolean}>({scope,meetings:[],callingEnabled:false});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[now,setNow]=useState(Date.now);
 const meetings=snapshot.scope===scope?snapshot.meetings:[],callingEnabled=snapshot.scope===scope&&snapshot.callingEnabled;
 const preview=!p.configured;
 const refresh=useCallback(async()=>{
  await Promise.resolve();
  if(scopeRef.current!==scope)return;
  setNow(Date.now());
  try{
   if(preview){const raw=localStorage.getItem(cacheKey);const saved=raw?JSON.parse(raw):[];if(scopeRef.current===scope)setSnapshot({scope,meetings:Array.isArray(saved)?saved:[],callingEnabled:false});}
   else if(p.client&&p.organizationId){const r=await p.client.request<MeetingsResponse>(`/v1/meetings?organizationId=${encodeURIComponent(p.organizationId)}`);if(scopeRef.current===scope)setSnapshot({scope,...r});}
   if(scopeRef.current===scope)setError('');
  }catch(cause){if(scopeRef.current===scope)setError(cause instanceof Error?cause.message:'Unable to load meetings')}
  finally{if(scopeRef.current===scope)setLoading(false)}
 },[preview,p.client,p.organizationId,cacheKey,scope]);
 useEffect(()=>{const initial=setTimeout(()=>void refresh(),0);const timer=setInterval(()=>void refresh(),30000);const onChange=()=>void refresh();window.addEventListener('ouranos-meetings-changed',onChange);window.addEventListener('storage',onChange);return()=>{clearTimeout(initial);clearInterval(timer);window.removeEventListener('ouranos-meetings-changed',onChange);window.removeEventListener('storage',onChange)}},[refresh]);
 function savePreview(next:Meeting[]){localStorage.setItem(cacheKey,JSON.stringify(next));setSnapshot({scope,meetings:next,callingEnabled:false});window.dispatchEvent(new Event('ouranos-meetings-changed'))}
 async function create(input:Omit<MeetingInput,'organizationId'>){
  const body=meetingInput.parse({...input,organizationId});
  if(preview){
   if(body.attendeeEmails.length)throw new Error('Sign in to a connected workspace to invite people.');
   const meeting:Meeting={id:crypto.randomUUID(),organizationId,organizerId:userId,title:body.title,startsAt:body.startsAt,endsAt:body.endsAt,attendeeIds:[],status:'scheduled',createdAt:new Date().toISOString()};
   savePreview([...meetings,meeting]);return meeting;
  }
  if(!p.client||!p.organizationId)throw new Error('Connect to a workspace first.');
  const r=await p.client.request<{meeting:Meeting}>('/v1/meetings',{method:'POST',body:JSON.stringify(body)});await refresh();return r.meeting;
 }
 async function cancel(id:string){
  if(preview){savePreview(meetings.map(m=>m.id===id?{...m,status:'cancelled'}:m));return {callEnded:true}}
  if(!p.client||!p.organizationId)throw new Error('Connect to a workspace first.');
  const r=await p.client.request<{callEnded:boolean}>(`/v1/meetings/${id}/cancel`,{method:'POST',body:JSON.stringify({organizationId})});await refresh();return r;
 }
 async function connect(id:string):Promise<MeetingConnection>{
  if(preview||!p.client)throw new Error('Calling needs a connected workspace and LiveKit setup.');
  return p.client.request(`/v1/meetings/${id}/token`,{method:'POST',body:JSON.stringify({organizationId})});
 }
 return {meetings,callingEnabled,loading:loading||snapshot.scope!==scope,error,now,preview,userId,refresh,create,cancel,connect};
}
