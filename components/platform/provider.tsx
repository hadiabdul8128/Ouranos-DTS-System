'use client';
import {createContext,useContext,useEffect,useState,useCallback,useRef,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {browserAuth,platformConfigured} from '@/lib/platform/browser';
import {OuranosClient,ApiFailure} from '@/packages/sdk';
import {OuranosDatabase} from '@/packages/offline/database';
import {LocalRepository} from '@/packages/offline/repository';
import {SyncEngine,type SyncState} from '@/packages/offline/sync';
import type {Role} from '@/packages/contracts';
const demoOrg='00000000-0000-4000-8000-000000000001';
type Membership={organizationId:string;name:string;role:Role};
type Platform={configured:boolean;loading:boolean;session:Session|null;client:OuranosClient|null;repository:LocalRepository|null;engine:SyncEngine|null;sync:SyncState;memberships:Membership[];organizationId:string|null;setOrganization:(id:string)=>void;refresh:()=>Promise<void>;signOut:()=>Promise<void>;error:string|null};
const Context=createContext<Platform|null>(null);
export function usePlatform(){const p=useContext(Context);if(!p)throw new Error('PlatformProvider missing');return p}
export function PlatformProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[memberships,setMemberships]=useState<Membership[]>([]),[organizationId,setOrganizationId]=useState<string|null>(null),[repository,setRepository]=useState<LocalRepository|null>(null),[engine,setEngine]=useState<SyncEngine|null>(null),[sync,setSync]=useState<SyncState>({state:'idle',pending:0}),[error,setError]=useState<string|null>(null);
 const identity=useRef<string|null>(null),refreshGeneration=useRef(0);
 const configured=platformConfigured();
 const [client]=useState(()=>configured?new OuranosClient(process.env.NEXT_PUBLIC_OURANOS_API_URL!,async()=>{const {data}=await browserAuth()!.auth.getSession();return data.session?.access_token||null}):null);
 const refresh=useCallback(async()=>{
  if(!client)return;
  const generation=++refreshGeneration.current,userId=identity.current;
  try{
   const info=await client.session();
   if(generation!==refreshGeneration.current||identity.current!==userId)return;
   if(info.user.id!==userId)throw new Error('Your identity changed. Sign in again to open the workspace.');
   setMemberships(info.memberships);
   setOrganizationId(current=>info.memberships.some(m=>m.organizationId===current)?current:info.memberships[0]?.organizationId||null);
   setError(null);
  }catch(e){
   if(generation!==refreshGeneration.current||identity.current!==userId)return;
   // Local storage is never evidence of current identity or membership. An open
   // workspace can keep editing offline, but a fresh session verifies access.
   if(e instanceof ApiFailure&&(e.status===401||e.status===403)){setMemberships([]);setOrganizationId(null)}
   setError(e instanceof Error?e.message:'Unable to reach Ouranos');throw e;
  }
 },[client]);
 useEffect(()=>{
  const auth=browserAuth();
  if(!auth){setOrganizationId(demoOrg);setLoading(false);return}
  let cancelled=false,updateGeneration=0;
  const update=async(next:Session|null)=>{
   if(cancelled)return;
   const generation=++updateGeneration;
   if(identity.current!==(next?.user.id||null)){
    ++refreshGeneration.current;identity.current=next?.user.id||null;
    setMemberships([]);setOrganizationId(null);setError(null);
   }
   setSession(next);
   try{if(next)await refresh()}catch{/* refresh exposes its error in settings */}
   if(!cancelled&&generation===updateGeneration)setLoading(false);
  };
  // Defer auth callbacks until initialization/notification processing finishes
  // before /session asks the SDK for its current access token.
  void auth.auth.getSession().then(({data,error:sessionError})=>{
   if(cancelled||updateGeneration)return;
   if(sessionError)setError(sessionError.message);
   return update(data.session);
  }).catch(e=>{if(!cancelled){setError(e instanceof Error?e.message:'Sign in unavailable');setLoading(false)}});
  const {data}=auth.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>{if(!cancelled)void update(next)},0)});
  return()=>{cancelled=true;++refreshGeneration.current;data.subscription.unsubscribe()};
 },[refresh]);
 useEffect(()=>{
  if(!organizationId||(configured&&!session))return;
  const userId=session?.user.id||'preview';
  const scope=`${process.env.NEXT_PUBLIC_SUPABASE_URL||'demo'}:${userId}:${organizationId}`;
  const db=new OuranosDatabase(scope),repo=new LocalRepository(db,organizationId);
  let active=true;
  setRepository(repo);setSync({state:'idle',pending:0});
  const e=client?new SyncEngine(db,client,organizationId,state=>{if(active)setSync(state)}):null;
  setEngine(e);e?.start();
  return()=>{
   active=false;setRepository(null);setEngine(null);
   // Let the one in-flight acknowledgment finish before closing its database.
   // stop prevents further requests and emissions for a departed workspace.
   if(e)void e.stop().finally(()=>db.close());else db.close();
  };
 },[organizationId,session?.user.id,configured,client]);
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production'||!('serviceWorker'in navigator))return;
  let active=true;
  void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{if(active)setError('Offline application loading is unavailable in this browser')});
  return()=>{active=false};
 },[]);
 const setOrganization=useCallback((id:string)=>{
  if(memberships.some(m=>m.organizationId===id))setOrganizationId(id);
 },[memberships]);
 async function signOut(){
  // Clear the rendered identity immediately; the SDK also clears its session.
  void engine?.stop();++refreshGeneration.current;
  const priorId=identity.current;identity.current=null;
  setSession(null);setMemberships([]);setOrganizationId(null);
  try{localStorage.removeItem('ouranos-offline-context');if(priorId)localStorage.removeItem('ouranos-memberships:'+priorId)}catch{/* Browser storage may be disabled. */}
  const auth=browserAuth();
  if(auth){const {error:signOutError}=await auth.auth.signOut({scope:'local'});if(signOutError){setError(signOutError.message);return}}
  window.location.assign('/');
 }
 return <Context.Provider value={{configured,loading,session,client,repository,engine,sync,memberships,organizationId,setOrganization,refresh,signOut,error}}>{children}</Context.Provider>
}
export function SyncIndicator(){const p=usePlatform();let label=p.configured?'Saved on this device':'Local preview';if(p.sync.state==='syncing')label='Syncing with Ouranos…';if(p.sync.state==='synced')label='Synced with Ouranos';if(p.sync.state==='offline')label='Offline · saved on this device';if(p.sync.state==='blocked')label='Sync needs attention';if(p.sync.state==='authentication_required')label='Sign in to sync';if(p.sync.state==='access_denied')label='Access needs review';return <a className="platform-status" href="/dashboard/platform" aria-live="polite">{label}{p.sync.pending>0?` · ${p.sync.pending} pending`:''}</a>}
export function WorkspaceGate({children}:{children:ReactNode}){const p=usePlatform();if(p.loading)return <main className="quiet-page"><p className="platform-loading">Opening your workspace…</p></main>;if(p.configured&&!p.session)return <main className="quiet-page"><div className="platform-loading">Sign in to open your workspace.<p><a href="/">Go to sign in</a></p></div></main>;return <>{children}</>}
