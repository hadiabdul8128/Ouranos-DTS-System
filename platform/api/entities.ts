import type { PoolClient } from 'pg';
import { type Entity, type EntityKind } from '../../packages/contracts/index';
import { DomainError } from '../../packages/domain/errors';
export const TABLES:Record<EntityKind,string>={trip:'trips',authorization:'authorizations',expense:'expenses',voucher:'vouchers',document:'documents',approval:'approval_requests',workflow:'workflow_definitions',notification:'notifications',integration:'integration_deliveries'};
export function toEntity(kind:EntityKind,row:Record<string,any>):Entity{return {id:row.id,organizationId:row.organization_id,tripId:row.trip_id,kind,version:row.version,status:row.status,data:row.data,updatedAt:new Date(row.updated_at).toISOString()}}
export async function loadEntity(db:PoolClient,kind:EntityKind,id:string,organizationId:string,lock=false){
 const r=await db.query(`select * from public.${TABLES[kind]} where id=$1 and organization_id=$2${lock?' for update':''}`,[id,organizationId]);
 if(!r.rows[0])throw new DomainError('NOT_FOUND','Record not found or not accessible',404);
 return r.rows[0];
}
export async function publishChange(db:PoolClient,kind:EntityKind,row:Record<string,any>){
 const e=toEntity(kind,row);
 await db.query('insert into public.change_log(organization_id,trip_id,kind,entity_id,entity) values($1,$2,$3,$4,$5)',[e.organizationId,e.tripId||(kind==='trip'?e.id:null),kind,e.id,JSON.stringify(e)]);
 return e;
}
export async function updateStatus(db:PoolClient,kind:EntityKind,id:string,org:string,status:string){
 const r=await db.query(`update public.${TABLES[kind]} set status=$3,version=version+1,updated_at=now() where id=$1 and organization_id=$2 returning *`,[id,org,status]);
 if(!r.rows[0])throw new DomainError('NOT_FOUND','Record not accessible',404);
 return publishChange(db,kind,r.rows[0]);
}
