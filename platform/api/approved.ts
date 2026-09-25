import type {PoolClient} from 'pg';
import {loadEntity} from './entities';
import {requireCondition as check} from '../../packages/domain/errors';
import type {ApprovedRevision} from '../../packages/domain/voucher-adapter';

export async function loadApprovedAuthorization(db:PoolClient,organizationId:string,id:string):Promise<ApprovedRevision>{
  const entity=await loadEntity(db,'authorization',id,organizationId);
  check(entity.status==='approved','INVALID_STATE_TRANSITION','An approved authorization is required',409);
  const revision=(await db.query(`select r.id,r.sha256,r.snapshot from ouranos.submission_revisions r
    join ouranos.approval_requests a on a.revision_id=r.id
    where r.organization_id=$1 and r.authorization_id=$2 and a.status='approved'
    order by r.created_at desc limit 1`,[organizationId,id])).rows[0];
  check(revision,'INVALID_STATE_TRANSITION','Approved authorization revision is missing',409);
  return revision;
}
