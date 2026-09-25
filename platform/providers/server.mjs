import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {ReceiptError,MAX_BYTES,scanBytes,extractBytes,checkScanner} from './receipts.mjs';

export function createReceiptServer({token,scan=scanBytes,extract=extractBytes,ready=checkScanner}){
  if(typeof token!=='string'||token.length<32)throw new Error('RECEIPT_PROVIDER_TOKEN must contain at least 32 characters');
  let busy=false;
  const expected=Buffer.from(`Bearer ${token}`);
  return createServer({requestTimeout:30000,headersTimeout:5000,keepAliveTimeout:5000},async(req,res)=>{
    const respond=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
    if(req.method==='GET'&&req.url==='/ready'){
      try{await ready();respond(200,{status:'ready'})}catch{respond(503,{error:'SCANNER_UNAVAILABLE'})}return;
    }
    if(req.method!=='POST'||!['/scan','/extract'].includes(req.url)){respond(404,{error:'NOT_FOUND'});return}
    const supplied=Buffer.from(req.headers.authorization||'');
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){respond(401,{error:'AUTHENTICATION_REQUIRED'});return}
    if(busy){res.setHeader('Retry-After','5');respond(503,{error:'PROVIDER_BUSY'});return}
    const type=String(req.headers['content-type']||'').split(';')[0];
    if(!['image/jpeg','image/png','application/pdf'].includes(type)){respond(415,{error:'UNSUPPORTED_MEDIA_TYPE'});return}
    const contentLength=req.headers['content-length'];
    if(contentLength&&(Number(contentLength)>MAX_BYTES||Number(contentLength)<1)){respond(413,{error:'INVALID_FILE_SIZE'});return}
    busy=true;
    const abort=new AbortController();
    // Leave time for the worker's 30-second HTTP deadline to receive an error.
    const deadline=setTimeout(()=>abort.abort(),24000);
    const onClose=()=>{if(!res.writableEnded)abort.abort()};
    res.on('close',onClose);
    try{
      const chunks=[];let size=0;
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        if(abort.signal.aborted)throw new ReceiptError('REQUEST_TIMEOUT');
        size+=chunk.length;
        if(size>MAX_BYTES)throw new ReceiptError('INVALID_FILE_SIZE',413);
        chunks.push(chunk);
      }
      if(!size)throw new ReceiptError('INVALID_FILE_SIZE',413);
      const bytes=Buffer.concat(chunks);
      const output=req.url==='/scan'?await scan(bytes,abort.signal):await extract(bytes,type,abort.signal);
      respond(200,output);
    }catch(error){
      if(!res.destroyed)respond(error instanceof ReceiptError?error.status:503,{error:error instanceof ReceiptError?error.message:'PROVIDER_UNAVAILABLE'});
      req.resume();
    }finally{clearTimeout(deadline);res.removeListener('close',onClose);busy=false}
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createReceiptServer({token:process.env.RECEIPT_PROVIDER_TOKEN});
  server.listen(Number(process.env.PORT||4200),process.env.HOST||'0.0.0.0',()=>console.log(JSON.stringify({event:'receipt_provider_started'})));
  const stop=()=>{server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>process.exit(1),30000).unref()};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
