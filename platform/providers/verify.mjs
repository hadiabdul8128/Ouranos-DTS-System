// Run against the optional local profile after it is healthy:
// node --env-file=.env.receipts platform/providers/verify.mjs
// Synthetic fixtures only; no production documents or external requests.
const base=new URL(process.env.RECEIPT_PROVIDER_URL||'http://127.0.0.1:4200');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw new Error('Provider smoke checks require a loopback endpoint');
const token=process.env.RECEIPT_PROVIDER_TOKEN||process.env.OURANOS_RECEIPT_TOKEN;
if(!token)throw new Error('Receipt provider token is required');
const content='BT /F1 24 Tf 72 700 Td (Merchant: Ouranos Hotel) Tj 0 -50 Td (Date 2026-10-15) Tj 0 -50 Td (Total USD 182.00) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
let pdf='%PDF-1.7\n';const offsets=[];
for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`}
const xref=Buffer.byteLength(pdf);
pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const request=async(path,body)=>{
  const response=await fetch(new URL(path,base),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/pdf'},body,signal:AbortSignal.timeout(30000)});
  return {status:response.status,body:await response.json()};
};
const clean=await request('/scan',pdf);
if(clean.status!==200||clean.body.clean!==true)throw new Error('Clean fixture did not pass scanning');
// EICAR is the standard inert anti-malware test string, not executable malware.
const eicar=String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;
const detected=await request('/scan',eicar);
if(detected.status!==200||detected.body.clean!==false)throw new Error('EICAR fixture was not detected');
const ocr=await request('/extract',pdf);
const field=name=>ocr.body.fields?.find(item=>item.name===name)?.value;
if(ocr.status!==200||field('amount')!==182||field('date')!=='2026-10-15'||field('currency')!=='USD'||field('merchant')!=='Ouranos Hotel')throw new Error('OCR and receipt-parser fixture failed');
const quarantined=await request('/extract',eicar);
if(quarantined.status!==422||quarantined.body.error!=='FILE_QUARANTINED')throw new Error('Extraction accepted an EICAR fixture');
console.log(JSON.stringify({cleanScan:true,eicarDetected:true,unsafeExtractionRejected:true,structuredOcr:true,modelVersion:ocr.body.modelVersion}));
