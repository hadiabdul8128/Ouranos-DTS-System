'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {FastForward} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import './demo-approve.css';

/** Across workspaces: approve your own submitted plan at every level and open the voucher. */
export function DemoApprove({authorizationId,tripId}:{authorizationId:string;tripId:string}){
 const p=usePlatform(),router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!p.demoApproval)return null;
 async function approve(){
  if(!p.client||!p.organizationId||busy)return;
  setBusy(true);setError('');
  try{
   await p.client.request('/v1/demo/approve',{method:'POST',body:JSON.stringify({organizationId:p.organizationId,authorizationId})});
   await p.engine?.sync();
   router.push(`/dashboard/travel/vouchers?tripId=${tripId}`);
  }catch(e){setError(e instanceof Error?e.message:'The demo approval didn’t go through. Try again.');setBusy(false)}
 }
 return <div className="demo-approve">
  <div><strong>Try the voucher demo</strong><span>Approve your submitted authorization for this demo and open its voucher.</span></div>
  <Button type="button" variant="outline" onClick={()=>void approve()} disabled={busy}><FastForward size={15}/> {busy?'Approving…':'Approve for demo'}</Button>
  {error&&<p role="alert">{error}</p>}
 </div>;
}
