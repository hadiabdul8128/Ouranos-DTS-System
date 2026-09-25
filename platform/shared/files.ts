import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireCondition } from '../../packages/domain/errors';
export function sniffType(bytes:Uint8Array):string|null{
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-')return 'application/pdf';return null;
}
export async function verifyStoredFile(storage:SupabaseClient,row:Record<string,any>){
 const {data,error}=await storage.storage.from('ouranos-documents').download(row.storage_key);
 requireCondition(!error&&data,'ATTACHMENT_INCOMPLETE','Receipt has not finished uploading',409);
 const bytes=new Uint8Array(await data.arrayBuffer());
 requireCondition(bytes.length===row.data.byteSize,'VALIDATION_FAILED','File size does not match registration');
 requireCondition(createHash('sha256').update(bytes).digest('hex')===row.data.sha256,'VALIDATION_FAILED','File checksum does not match registration');
 requireCondition(sniffType(bytes)===row.data.mediaType,'VALIDATION_FAILED','Detected file type does not match registration');
 return bytes;
}
