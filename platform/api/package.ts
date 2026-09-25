import type {PoolClient} from 'pg';
import {loadEntity,toEntity} from './entities';
import {loadWorkingPlan} from './working';
import {createHash} from 'node:crypto';
import {requireCondition as check} from '../../packages/domain/errors';
import {approvedTravel,approvedAllowance,storedExpenseRows,resolvedStatements,type ApprovedRevision} from '../../packages/domain/voucher-adapter';
import {z} from 'zod';
import {VOUCHER_MODULE_SCHEMA_VERSION,voucherResolutionSchema} from '../../packages/contracts/voucher-module';
import type {Entity} from '../../packages/contracts';
import {buildDtsChecklist} from '../../voucher/src/dtsChecklist.js';
import {buildEvidenceHtml} from '../../voucher/src/evidencePackage.js';

/** Export the submitted version, never a mutable draft or client assertion. */
export async function loadVoucherPackage(db:PoolClient,org:string,id:string){
 const voucher=await loadEntity(db,'voucher',id,org);
 check(['in_review','approved'].includes(voucher.status),'INVALID_STATE_TRANSITION','Submit the voucher before downloading its package',409);
 const revision=(await db.query(`select r.id,r.sha256,r.snapshot,r.created_at from ouranos.submission_revisions r
  join ouranos.approval_requests a on a.revision_id=r.id
  where r.organization_id=$1 and r.voucher_id=$2 and a.status=$3 order by r.created_at desc limit 1`,[org,id,voucher.status])).rows[0];
 check(revision?.snapshot?.authorizationRevision,'INVALID_STATE_TRANSITION','This revision has no connected travel package',409);
 return renderPackage(voucher,revision);
}

export async function loadDraftVoucherPackage(db:PoolClient,org:string,id:string){
 const voucher=await loadEntity(db,'voucher',id,org);
 const authorizationRevision=await loadWorkingPlan(db,org,voucher.authorization_id);
 check(authorizationRevision.snapshot.trip.id===voucher.trip_id,'VALIDATION_FAILED','Plan belongs to another trip');
 check(voucher.data.formSchemaVersion===VOUCHER_MODULE_SCHEMA_VERSION,'VALIDATION_FAILED','Save a current voucher before exporting');
 z.record(voucherResolutionSchema).parse(voucher.data.formData?.resolutions||{});
 const expenses:Entity[]=[],documents:Entity[]=[];
 for(const expenseId of voucher.data.expenseIds){
  const expense=await loadEntity(db,'expense',expenseId,org);
  check(expense.trip_id===voucher.trip_id,'VALIDATION_FAILED','Expense belongs to another trip');
  expenses.push(toEntity('expense',expense));
  for(const documentId of expense.data.documentIds){
   const document=await loadEntity(db,'document',documentId,org);
   check(document.trip_id===voucher.trip_id&&['ready','needs_review'].includes(document.status),'ATTACHMENT_INCOMPLETE','Wait for receipt processing before exporting',409);
   documents.push(toEntity('document',document));
  }
 }
 const snapshot={preview:true,entity:toEntity('voucher',voucher),trip:authorizationRevision.snapshot.trip,authorizationRevision,expenses,documents};
 const sha256=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 return renderPackage(voucher,{id:sha256,sha256,snapshot,created_at:voucher.updated_at});
}

function renderPackage(voucher:any,revision:any){
 const snapshot=revision.snapshot;
 const approved=snapshot.authorizationRevision as ApprovedRevision;
 const documents=Array.from(new Map((snapshot.documents as Entity[]).map(d=>[d.id,d])).values());
 const expenses=snapshot.expenses as Entity[];
 const trip=approvedTravel(approved),perDiem=approvedAllowance(approved);
 const rows=storedExpenseRows(expenses,documents);
 const resolutions=resolvedStatements(approved,expenses,snapshot.entity.data.formData.resolutions||{});
 const data={trip,expenses:rows,perDiem:perDiem?.supported?perDiem:null,resolutions};
 const checklist=buildDtsChecklist(data);
 const rendered=buildEvidenceHtml({...data,generatedAt:new Date(revision.created_at).toISOString()});
 const html=snapshot.preview?rendered.replace('<body>','<body><p>Draft preview — not approved or submitted to DTS.</p>'):rendered;
 return {id:voucher.id,status:voucher.status,revisionId:revision.id,sha256:revision.sha256,
  destination:String(snapshot.trip.data.destination),checklist,html,perDiem,documents,
  snapshot,generatedAt:new Date(revision.created_at).toISOString()};
}
