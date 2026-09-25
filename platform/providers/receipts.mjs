import {connect} from 'node:net';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseReceiptText} from '../../voucher/src/receiptParser.js';

const execute=promisify(execFile);
export const MAX_BYTES=20*1024*1024;
const MAX_PIXELS=25_000_000,MAX_PAGES=10;
export class ReceiptError extends Error {
  constructor(code,status=503){super(code);this.status=status}
}

export function parseScanResult(response){
  const result=response.replace(/\0.*$/s,'').trim();
  if(result==='stream: OK')return {clean:true};
  if(/^stream: .+ FOUND$/.test(result))return {clean:false};
  throw new ReceiptError('SCAN_INCOMPLETE');
}

async function clamd(command,bytes,signal){
  const socket=connect({host:process.env.CLAMD_HOST||'clamav',port:Number(process.env.CLAMD_PORT||3310)});
  const timeout=setTimeout(()=>socket.destroy(new ReceiptError('SCAN_TIMEOUT')),15000);
  const abort=()=>socket.destroy(new ReceiptError('REQUEST_CANCELLED'));
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  let received='';
  const result=new Promise((resolve,reject)=>{
    socket.on('error',()=>reject(new ReceiptError('SCANNER_UNAVAILABLE')));
    socket.on('data',chunk=>{
      received+=chunk.toString('utf8');
      if(received.length>8192){reject(new ReceiptError('INVALID_SCANNER_RESPONSE'));socket.destroy()}
      else if(received.includes('\0'))resolve(received.slice(0,received.indexOf('\0')));
    });
    socket.on('end',()=>{if(!received.includes('\0'))reject(new ReceiptError('SCAN_INCOMPLETE'))});
  });
  // Attach a handler immediately so connection failure cannot become an
  // unhandled rejection while the upload loop is awaiting backpressure.
  void result.catch(()=>{});
  try{
    await once(socket,'connect');
    socket.write(`z${command}\0`);
    if(bytes){
      for(let offset=0;offset<bytes.length;offset+=65536){
        const chunk=bytes.subarray(offset,offset+65536),length=Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        if(!socket.write(Buffer.concat([length,chunk])))await once(socket,'drain');
      }
      socket.write(Buffer.alloc(4));
    }
    return await result;
  }catch{throw new ReceiptError('SCANNER_UNAVAILABLE')}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);socket.destroy()}
}

export async function checkScanner(signal){
  const version=await clamd('VERSION',undefined,signal);
  const signatureDate=Date.parse(version.split('/').slice(2).join('/'));
  if(!version.startsWith('ClamAV ')||!Number.isFinite(signatureDate)||Date.now()-signatureDate>7*86400000||signatureDate>Date.now()+86400000)throw new ReceiptError('SCANNER_SIGNATURES_STALE');
  return version;
}

export async function scanBytes(bytes,signal){
  if(!bytes.length||bytes.length>MAX_BYTES)throw new ReceiptError('INVALID_FILE_SIZE',413);
  await checkScanner(signal);
  return parseScanResult(await clamd('INSTREAM',bytes,signal));
}

export function imageDimensions(bytes,type){
  if(type==='image/png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(type==='image/jpeg'&&bytes.length>4&&bytes[0]===255&&bytes[1]===216){
    let offset=2;
    while(offset+4<=bytes.length){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(offset+2>bytes.length)break;
      const length=bytes.readUInt16BE(offset);
      if(length<2||offset+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return {width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};
      offset+=length;
    }
  }
  throw new ReceiptError('INVALID_IMAGE',422);
}

export function fieldsFromTsv(tsv,page){
  const words=[],lines=new Map();
  for(const line of tsv.split('\n').slice(1)){
    const columns=line.split('\t'),confidence=Number(columns[10]),text=columns.slice(11).join(' ').trim();
    if(columns[0]==='5'&&text&&Number.isFinite(confidence)&&confidence>=0&&confidence<=100){
      words.push({text,confidence});
      const key=columns.slice(1,5).join(':');
      if(!lines.has(key))lines.set(key,[]);
      lines.get(key).push(text);
    }
  }
  if(!words.length)return [];
  const text=[...lines.values()].map(line=>line.join(' ')).join('\n');
  if(text.length>10000)throw new ReceiptError('OCR_PAGE_TEXT_LIMIT',422);
  return [{name:`text.page.${page}`,value:text,confidence:words.reduce((total,word)=>total+word.confidence,0)/words.length/100,page}];
}

export function structuredFields(pageFields){
  const parsed=parseReceiptText(pageFields.map(field=>field.value).join('\n'));
  const textConfidence=pageFields.length?pageFields.reduce((sum,field)=>sum+field.confidence,0)/pageFields.length:0;
  // These map the collaborator parser's heuristic labels, capped by measured
  // OCR confidence. They are review hints, not calibrated probabilities.
  const scores={high:.9,medium:.6,low:.3};
  const fields=[];
  for(const name of ['merchant','date','amount','currency']){
    const value=parsed.fields[name];
    if(name==='merchant'&&(typeof value!=='string'||!value.trim()||value.length>200))continue;
    if(name==='date'&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)))continue;
    if(name==='amount'&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER/100))continue;
    // The parser defaults to USD when no currency is printed; do not present
    // that fallback as an extracted fact.
    if(name==='currency'&&(parsed.confidence.currency==='low'||!['USD','EUR','GBP','CAD'].includes(value)))continue;
    fields.push({name,value,confidence:Math.min(textConfidence,scores[parsed.confidence[name]]||0)});
  }
  return fields;
}

export async function extractBytes(bytes,mediaType,signal){
  // The endpoint is independently safe: never feed unscanned bytes to parsers,
  // even when called outside the normal worker scan -> extract sequence.
  if(!(await scanBytes(bytes,signal)).clean)throw new ReceiptError('FILE_QUARANTINED',422);
  const directory=await mkdtemp(join(tmpdir(),'ouranos-receipt-'));
  const timeoutSignal=AbortSignal.timeout(27000);
  const bounded=signal?AbortSignal.any([signal,timeoutSignal]):timeoutSignal;
  const run=(binary,args)=>execute(binary,args,{signal:bounded,timeout:27000,maxBuffer:2*1024*1024,env:{...process.env,OMP_THREAD_LIMIT:'1'}});
  try{
    let pageCount=1;
    const pdf=mediaType==='application/pdf';
    if(pdf){if(bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw new ReceiptError('INVALID_PDF',422)}
    else{
      const size=imageDimensions(bytes,mediaType);
      if(!size.width||!size.height||size.width*size.height>MAX_PIXELS)throw new ReceiptError('IMAGE_DIMENSION_LIMIT',422);
    }
    const input=join(directory,pdf?'input.pdf':mediaType==='image/png'?'input.png':'input.jpg');
    await writeFile(input,bytes,{mode:0o600});
    if(pdf){
      const {stdout}=await run('pdfinfo',[input]);
      pageCount=Number(stdout.match(/^Pages:\s+(\d+)\s*$/m)?.[1]);
      if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>MAX_PAGES)throw new ReceiptError('PDF_PAGE_LIMIT',422);
      if(/^Encrypted:\s+yes/m.test(stdout))throw new ReceiptError('ENCRYPTED_PDF',422);
    }
    const {stdout:version}=await run('tesseract',['--version']);
    const fields=[];
    for(let page=1;page<=pageCount;page++){
      let image=input;
      if(pdf){
        const prefix=join(directory,`page-${page}`);
        await run('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to','2500','-png',input,prefix]);
        image=`${prefix}.png`;
      }
      const {stdout}=await run('tesseract',[image,'stdout','-l','eng','--psm','6','tsv']);
      fields.push(...fieldsFromTsv(stdout,page));
      if(pdf)await rm(image,{force:true});
    }
    return {modelVersion:`${version.split('\n')[0].trim()}-eng-poppler-voucher-parser-v1`,fields:[...fields,...structuredFields(fields)]};
  }catch(error){
    if(error instanceof ReceiptError)throw error;
    throw new ReceiptError(bounded.aborted?'OCR_TIMEOUT':'OCR_FAILED',bounded.aborted?503:422);
  }finally{await rm(directory,{recursive:true,force:true})}
}
