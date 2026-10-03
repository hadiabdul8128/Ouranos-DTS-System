import type {PoolClient} from 'pg';
import {loadEntity} from './entities';
import {requireCondition as check} from '../../packages/domain/errors';
import type {ApprovedRevision} from '../../packages/domain/voucher-adapter';

export async function loadApprovedAuthorization(db:PoolClient,organizationId:string,id:string):Promise<ApprovedRevision>{
  const entity=await loadEntity(db,'authorization',id,organizationId);
  check(entity.status==='approved','INVALID_STATE_TRANSITION','An approved authorization is required',409);
  const revision=(await db.query(`select r.id,r.sha256,r.snapshot from ouranos.submission_revisions r
    where r.organization_id=$1 and r.authorization_id=$2 and (
      exists(select 1 from ouranos.approval_requests a where a.revision_id=r.id and a.status='approved')
      or (r.snapshot->'verification'->>'mode'='automatic' and r.snapshot->'verification'->>'result'='verified')
      or exists(select 1 from ouranos.audit_events audit
        where audit.organization_id=r.organization_id and audit.entity_id=r.authorization_id
          and audit.trip_id=r.trip_id and audit.actor_id=r.submitted_by and audit.action='approval.demo_approved'
          and (audit.details->>'revisionId'=r.id::text
            or (not (audit.details ? 'revisionId') and r.id=(
              select prior.id from ouranos.submission_revisions prior
              where prior.organization_id=r.organization_id and prior.authorization_id=r.authorization_id
                and prior.created_at<=audit.created_at order by prior.created_at desc limit 1
            )))
      )
    )
    order by r.created_at desc limit 1`,[organizationId,id])).rows[0];
  check(revision,'INVALID_STATE_TRANSITION','Approved authorization revision is missing',409);
  return revision;
}
