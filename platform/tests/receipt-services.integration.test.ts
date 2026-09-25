import {it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {readConfig} from '../shared/config';
import {makePool,withActor} from '../shared/database';
import {executeCommand} from '../api/commands';
import {runOne} from '../worker/runner';
import type {Command} from '../../packages/contracts';

const config=readConfig();
const enabled=config.SCAN_PROVIDER==='http'&&config.OCR_PROVIDER==='http';
const local=(url:string)=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
if(!local(config.SUPABASE_URL)||!local(config.DATABASE_URL))throw new Error('Receipt integration requires local Auth and database');
if(enabled&&(!local(config.SCAN_URL!)||!local(config.OCR_URL!)))throw new Error('Live receipt check only uses local providers');

function receiptPdf(){
 const content='BT /F1 20 Tf 50 740 Td (MERCHANT: OURANOS TEST HOTEL) Tj 0 -35 Td (DATE: 2026-10-12) Tj 0 -35 Td (TOTAL 182.00 USD) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [index,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf);
}

it.skipIf(!enabled)('uploads, scans, extracts, and confirms a real receipt through local services',async()=>{
 const pool=makePool(config),storage=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
 const organizationId=randomUUID(),tripId=randomUUID(),documentId=randomUUID(),deviceId=randomUUID();
 try{
  const {data,error}=await storage.auth.admin.createUser({email:`receipt-services-${randomUUID()}@ouranos.test`,password:randomUUID()+randomUUID(),email_confirm:true});if(error)throw error;const userId=data.user.id;
  await withActor(pool,userId,undefined,async db=>{await db.query('select ouranos.create_organization($1,$2)',[organizationId,'Local receipt services test'])});
  async function send(type:string,entityId:string,expectedVersion:number,payload:unknown){const result=await executeCommand(pool,storage,userId,{commandId:randomUUID(),organizationId,entityId,deviceId,schemaVersion:1,expectedVersion,type,payload} as Command,true);if(!result.ok)throw new Error(result.error.message);return result.entity}
  await send('trip.save',tripId,0,{destination:'Washington',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Synthetic service test'});
  const bytes=receiptPdf();await send('document.register',documentId,0,{tripId,filename:'synthetic-receipt.pdf',mediaType:'application/pdf',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  const doc=(await pool.query('select * from ouranos.documents where id=$1',[documentId])).rows[0];
  const upload=await storage.storage.from('ouranos-documents').upload(doc.storage_key,bytes,{contentType:'application/pdf'});expect(upload.error).toBeNull();
  const finalized=await send('document.finalize',documentId,1,{});
  await runOne(pool,storage,config,undefined,{organizationId,jobKey:`receipt:${documentId}:${finalized.version}`});
  const processed=(await pool.query('select * from ouranos.documents where id=$1',[documentId])).rows[0];expect(processed.status).toBe('needs_review');
  const extraction=(await pool.query('select result from ouranos.extraction_runs where document_id=$1',[documentId])).rows[0].result;
  expect(JSON.stringify(extraction)).toContain('182.00');
  expect((await send('document.confirm',documentId,processed.version,{})).status).toBe('ready');
 }finally{await pool.end()}
},60000);
