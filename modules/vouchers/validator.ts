import {VOUCHER_MODULE_SCHEMA_VERSION,voucherModuleSchema} from '../../packages/contracts/voucher-module';

/** Form consistency only; the API independently checks persisted trip records. */
export function validateVoucher(schemaVersion:string,data:Record<string,unknown>,development:boolean):string[]{
 if(development&&schemaVersion==='ouranos.fixture.v1')return data.certified===true?[]:['certified must be true'];
 if(schemaVersion===VOUCHER_MODULE_SCHEMA_VERSION){
  const result=voucherModuleSchema.safeParse(data);
  return result.success?[]:result.error.issues.map(issue=>`${issue.path.join('.')||'voucher'}: ${issue.message}`);
 }
 return [`Voucher schema ${schemaVersion} has not been integrated. Register its submission validator in modules/vouchers/validator.ts.`];
}
