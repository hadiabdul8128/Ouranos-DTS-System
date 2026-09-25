import {z} from 'zod';
import type {PlatformConfig} from '../shared/config';
export const extractionSchema=z.object({modelVersion:z.string().min(1).max(200),fields:z.array(z.object({name:z.string().min(1).max(100),value:z.union([z.string().max(10000),z.number(),z.boolean(),z.null()]),confidence:z.number().min(0).max(1),page:z.number().int().positive().optional()}).strict()).max(500)}).strict();
export type Extraction=z.infer<typeof extractionSchema>;
async function call(url:string,token:string|undefined,bytes:Uint8Array,mediaType:string,documentId:string,jobKey:string){
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':mediaType,'X-Document-Id':documentId,'Idempotency-Key':jobKey,...(token?{Authorization:`Bearer ${token}`}:{})},body:Buffer.from(bytes)});
 if(!response.ok)throw new Error(`PROVIDER_HTTP_${response.status}`);
 const text=await response.text();if(text.length>1024*1024)throw new Error('PROVIDER_RESPONSE_TOO_LARGE');return JSON.parse(text);
}
export interface ReceiptProviders {
 scan:(bytes:Uint8Array,mediaType:string,id:string,key:string)=>Promise<{clean:boolean}>;
 extract:(bytes:Uint8Array,mediaType:string,id:string,key:string)=>Promise<Extraction>;
}
export function makeProviders(c:PlatformConfig):ReceiptProviders|null{
 if(c.SCAN_PROVIDER==='disabled'||c.OCR_PROVIDER==='disabled')return null;
 for(const url of [c.SCAN_URL!,c.OCR_URL!])if(c.NODE_ENV==='production'&&!url.startsWith('https://'))throw new Error('Production provider URLs require HTTPS');
 return {scan:async(b,m,i,k)=>z.object({clean:z.boolean()}).parse(await call(c.SCAN_URL!,c.SCAN_TOKEN,b,m,i,k)),extract:async(b,m,i,k)=>extractionSchema.parse(await call(c.OCR_URL!,c.OCR_TOKEN,b,m,i,k))};
}
