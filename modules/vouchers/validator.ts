/** Partner extension point: attestations, policy, required form fields and totals. */
export function validateVoucher(schemaVersion:string,data:Record<string,unknown>,development:boolean):string[]{
 if(development&&schemaVersion==='ouranos.fixture.v1')return data.certified===true?[]:['certified must be true'];
 return [`Voucher schema ${schemaVersion} has not been integrated. Register its submission validator in modules/vouchers/validator.ts.`];
}
