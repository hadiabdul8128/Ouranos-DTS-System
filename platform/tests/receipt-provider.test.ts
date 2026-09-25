import {afterEach,describe,expect,it} from 'vitest';
import type {Server} from 'node:http';
import {createReceiptServer} from '../providers/server.mjs';
import {fieldsFromTsv,imageDimensions,parseScanResult,structuredFields} from '../providers/receipts.mjs';

const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))))});
async function start(overrides:Record<string,unknown>={}){
 const server=createReceiptServer({token:'x'.repeat(32),scan:async()=>({clean:true}),extract:async()=>({modelVersion:'test',fields:[]}),ready:async()=>{},...overrides});servers.push(server);
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('Listener unavailable');return `http://127.0.0.1:${address.port}`;
}
describe('receipt provider boundary',()=>{
 it('never treats scanner errors or truncated results as clean',()=>{
  expect(parseScanResult('stream: OK\0')).toEqual({clean:true});
  expect(parseScanResult('stream: Eicar-Signature FOUND\0')).toEqual({clean:false});
  expect(()=>parseScanResult('stream: size limit exceeded ERROR\0')).toThrow('SCAN_INCOMPLETE');
  expect(()=>parseScanResult('')).toThrow('SCAN_INCOMPLETE');
 });
 it('returns reviewed OCR text with measured word confidence',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const value=fieldsFromTsv(`${header}\n5\t1\t1\t1\t1\t1\t0\t0\t20\t10\t98\tTOTAL\n5\t1\t1\t1\t1\t2\t0\t0\t20\t10\t90\t182.00`,1);
  expect(value).toEqual([{name:'text.page.1',value:'TOTAL 182.00',confidence:.94,page:1}]);
  expect(()=>imageDimensions(Buffer.from('not an image'),'image/png')).toThrow('INVALID_IMAGE');
 });
 it('requires provider authentication and supported content',async()=>{
  const url=await start();
  expect((await fetch(`${url}/scan`,{method:'POST',body:'fixture'})).status).toBe(401);
  expect((await fetch(`${url}/scan`,{method:'POST',headers:{Authorization:`Bearer ${'x'.repeat(32)}`,'Content-Type':'text/plain'},body:'fixture'})).status).toBe(415);
 });
 it('preserves receipt lines and reuses the voucher parser for structured values',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const source=['Merchant: Ouranos Hotel','Date 2026-10-15','Subtotal USD 170.00','Total USD 182.00'];
  const rows=source.flatMap((line,index)=>line.split(' ').map((word,wordIndex)=>`5\t1\t1\t1\t${index+1}\t${wordIndex+1}\t0\t0\t20\t10\t96\t${word}`));
  const pages=fieldsFromTsv([header,...rows].join('\n'),1);
  expect(pages[0].value).toBe(source.join('\n'));
  expect(structuredFields(pages)).toEqual(expect.arrayContaining([
   {name:'merchant',value:'Ouranos Hotel',confidence:.9},
   {name:'date',value:'2026-10-15',confidence:.9},
   {name:'amount',value:182,confidence:.9},
   {name:'currency',value:'USD',confidence:.9},
  ]));
  expect(structuredFields([{name:'text.page.1',value:'Total 12.00',confidence:.95,page:1}]).some(field=>field.name==='currency')).toBe(false);
 });
 it('fails closed when scanning is unavailable',async()=>{
  const url=await start({scan:async()=>{throw new Error('socket failed')}});
  const response=await fetch(`${url}/scan`,{method:'POST',headers:{Authorization:`Bearer ${'x'.repeat(32)}`,'Content-Type':'application/pdf'},body:'fixture'});
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'PROVIDER_UNAVAILABLE'});
 });
 it('does not report readiness with a missing scanner',async()=>{
  const url=await start({ready:async()=>{throw new Error('missing signatures')}});
  expect((await fetch(`${url}/ready`)).status).toBe(503);
 });
});
