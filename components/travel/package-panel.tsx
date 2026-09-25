'use client';
import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {TravelPackage} from '@/packages/domain/travel-package';
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function download(bytes:Uint8Array|string,name:string,type:string){const url=URL.createObjectURL(new Blob([typeof bytes==='string'?bytes:Uint8Array.from(bytes)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function digest(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
const encode=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)};
export function TravelPackagePanel(props:{voucherId:string;refreshKey?:string}){const p=usePlatform();return <TravelPackageContent key={`${p.session?.user.id}:${p.organizationId}:${props.voucherId}:${props.refreshKey}`} {...props}/> }
function TravelPackageContent({voucherId,refreshKey}:{voucherId:string;refreshKey?:string}){
 const p=usePlatform();const [pack,setPack]=useState<TravelPackage|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[passphrase,setPassphrase]=useState('');
 useEffect(()=>{let active=true;if(p.client&&p.organizationId)void p.client.voucherPackage(voucherId,p.organizationId).then(v=>{if(active)setPack(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[voucherId,refreshKey,p.client,p.organizationId]);
 async function exportPackage(encrypted=false){
  if(!pack||!p.client||!p.organizationId)return;setBusy(true);setError('');
  try{
   const current=await p.client.voucherPackage(voucherId,p.organizationId);
   if(current.revisionId!==pack.revisionId)throw new Error('This submission changed. Reload before downloading.');
   setPack(current);
   if(current.documents.reduce((sum,d)=>sum+Number(d.data.byteSize),0)>50*1024*1024)throw new Error('Package exceeds 50 MB. Download receipts individually.');
   const {zipSync,strToU8}=await import('fflate');const files:Record<string,Uint8Array>={};const links:string[]=[];
   for(const doc of current.documents){
    const {url}=await p.client.download(doc.id,p.organizationId);const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('A receipt could not be downloaded. Try again.');
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==Number(doc.data.byteSize)||await digest(bytes)!==doc.data.sha256)throw new Error('Receipt integrity check failed.');
    const extension=doc.data.mediaType==='application/pdf'?'pdf':doc.data.mediaType==='image/png'?'png':'jpg';const path=`receipts/${doc.id}.${extension}`;files[path]=bytes;
    links.push(`<li><a href="${path}">${escape(doc.data.filename)}</a><small> · SHA-256 ${escape(doc.data.sha256)}</small></li>`);
   }
   const status=current.status==='approved'?'Approved in Ouranos':'In review in Ouranos';
   files['index.html']=strToU8(current.html.replace('<body>',`<body><p>${status} · Not submitted to DTS</p>`).replace('</body>',`<section class="page"><h2>Original receipts</h2><ul>${links.join('')}</ul><p>Submission ${escape(current.revisionId)} · ${escape(current.sha256)}</p></section></body>`));
   files['submission.json']=strToU8(JSON.stringify({revisionId:current.revisionId,sha256:current.sha256,status:current.status,snapshot:current.snapshot},null,2));
   const zip=zipSync(files,{level:1});
   if(encrypted){const {encryptBackup}=await import('@/voucher/src/backup.js');const value=await encryptBackup({format:'ouranos-travel-package',version:1,sha256:await digest(zip),archive:encode(zip)},passphrase);download(value,'ouranos-package.encrypted.json','application/json');setPassphrase('')}
   else download(zip,'ouranos-travel-package.zip','application/zip');
  }catch(e){setError(e instanceof Error?e.message:'Download failed.')}finally{setBusy(false)}
 }
 return <section className="cw-package"><div className="cw-section-heading"><div><h2>{pack?.status==='approved'?'Approved.':'In review.'}</h2><span className="cw-muted">DTS preparation package</span></div><Button disabled={!pack||busy} onClick={()=>void exportPackage()}><Download size={16}/>{busy?'Preparing…':'Download'}</Button></div>
 {error&&<p className="cw-error" role="alert">{error}</p>}
 {pack&&<details className="cw-disclosure"><summary>Package details</summary><p className="cw-muted">Open index.html to print. Original receipts are included. Submit separately in DTS.</p>{pack.checklist.steps.map((step,i)=><details className="cw-disclosure" key={i}><summary>{step.title}</summary><ul>{step.items.map((item,j)=><li key={j}>{item.text}{item.evidence&&<small> · {item.evidence}</small>}{(item.source||item.rule)&&<small className="cw-source">{item.source||item.rule}</small>}</li>)}</ul></details>)}<details className="cw-disclosure"><summary>Encrypted copy</summary><label className="cw-field"><span>Passphrase</span><Input type="password" autoComplete="new-password" minLength={10} value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label><Button variant="outline" disabled={busy||passphrase.length<10} onClick={()=>void exportPackage(true)}>Save encrypted copy</Button></details></details>}
 </section>;
}
export function OpenSavedPackage(){
 const [file,setFile]=useState<File|null>(null),[passphrase,setPassphrase]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function open(){if(!file)return;setBusy(true);setError('');try{if(file.size>100*1024*1024)throw new Error('This file is too large.');const {decryptBackup}=await import('@/voucher/src/backup.js');const value=await decryptBackup(await file.text(),passphrase);if(value?.format!=='ouranos-travel-package'||value.version!==1||typeof value.archive!=='string')throw new Error('Choose an Ouranos travel package.');const bytes=Uint8Array.from(atob(value.archive),c=>c.charCodeAt(0));if(await digest(bytes)!==value.sha256)throw new Error('Package integrity check failed.');download(bytes,'ouranos-travel-package.zip','application/zip');setPassphrase('')}catch(e){setError(e instanceof Error?e.message:'Unable to open package.')}finally{setBusy(false)}}
 return <details className="cw-disclosure cw-backup"><summary>Open saved package</summary><label className="cw-field"><span>Encrypted file</span><input type="file" accept="application/json,.json" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label className="cw-field"><span>Passphrase</span><Input type="password" value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label><Button variant="outline" disabled={!file||!passphrase||busy} onClick={()=>void open()}>{busy?'Opening…':'Open'}</Button>{error&&<p role="alert">{error}</p>}</details>;
}
