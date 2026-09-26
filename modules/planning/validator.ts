import {planningModuleSchema, PLANNING_SCHEMA_VERSION} from '../../packages/contracts/planning-module';
/** Ouranos validates the form's structure and budget consistency. The caller
 * chooses formal human review or internal automatic verification. */
export function validatePlanning(schemaVersion:string,data:Record<string,unknown>,development:boolean):string[]{
 if(schemaVersion===PLANNING_SCHEMA_VERSION){const result=planningModuleSchema.safeParse(data);return result.success?[]:result.error.issues.map(issue=>issue.message)}
 if(development&&schemaVersion==='ouranos.fixture.v1')return data.purpose?[]:['purpose is required'];
 return [`Planning schema ${schemaVersion} has not been integrated. Register its submission validator in modules/planning/validator.ts.`];
}
