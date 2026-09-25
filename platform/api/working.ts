import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {loadEntity,toEntity} from './entities';
import {requireCondition as check} from '../../packages/domain/errors';
import {PLANNING_SCHEMA_VERSION,planningModuleSchema} from '../../packages/contracts/planning-module';
import {planAllowance} from '../../packages/domain/voucher-adapter';

// A working copy never creates an approval, decision, or immutable submission.
export async function loadWorkingPlan(db:PoolClient,org:string,id:string){
 const row=await loadEntity(db,'authorization',id,org);
 const trip=toEntity('trip',await loadEntity(db,'trip',row.trip_id,org));
 const entity=toEntity('authorization',row);
 check(entity.data.formSchemaVersion===PLANNING_SCHEMA_VERSION,'VALIDATION_FAILED','Save a current travel plan before continuing');
 const form=planningModuleSchema.parse(entity.data.formData);
 const snapshot={entity,trip,perDiem:planAllowance(trip,form),preview:true};
 return {id:entity.id,sha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),snapshot};
}
