/** Replace/register your real form schema here. Drafts accept any version;
 * submission requires a registered validator. No generic form is silently approved. */
export function validatePlanning(schemaVersion:string,data:Record<string,unknown>,development:boolean):string[]{
 if(development&&schemaVersion==='ouranos.fixture.v1')return data.purpose?[]:['purpose is required'];
 return [`Planning schema ${schemaVersion} has not been integrated. Register its submission validator in modules/planning/validator.ts.`];
}
