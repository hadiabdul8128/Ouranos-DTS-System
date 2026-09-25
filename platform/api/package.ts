import type {PoolClient} from 'pg';
import {loadEntity} from './entities';
import {requireCondition as check} from '../../packages/domain/errors';
import {approvedTravel,approvedAllowance,storedExpenseRows,resolvedStatements,type ApprovedRevision} from '../../packages/domain/voucher-adapter';
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
 const snapshot=revision.snapshot;
 const approved=snapshot.authorizationRevision as ApprovedRevision;
 const documents=Array.from(new Map((snapshot.documents as Entity[]).map(d=>[d.id,d])).values());
 const expenses=snapshot.expenses as Entity[];
 const trip=approvedTravel(approved),perDiem=approvedAllowance(approved);
 const rows=storedExpenseRows(expenses,documents);
 const resolutions=resolvedStatements(approved,expenses,snapshot.entity.data.formData.resolutions||{});
 const data={trip,expenses:rows,perDiem:perDiem?.supported?perDiem:null,resolutions};
 const checklist=buildDtsChecklist(data);
 const html=buildEvidenceHtml({...data,generatedAt:new Date(revision.created_at).toISOString()});
 return {id:voucher.id,status:voucher.status,revisionId:revision.id,sha256:revision.sha256,
  destination:String(snapshot.trip.data.destination),checklist,html,perDiem,documents,
  snapshot,generatedAt:new Date(revision.created_at).toISOString()};
}
