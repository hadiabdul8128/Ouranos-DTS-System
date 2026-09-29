import {expect,it} from 'vitest';
import {mergePlanningEstimates} from '../../packages/domain/planning-estimates';
it('fills a blank lodging row and includes it in the planned total',()=>{
 const airfare={id:'airfare',amount:'620.00',description:'Flight',merchant:''};
 const lodging={id:'lodging',amount:'',description:'',merchant:''};
 const estimates=[{...lodging,amount:'570.00',description:'Lodging'},{id:'meals',amount:'250.00',description:'Meals & incidentals',merchant:''}];
 const result=mergePlanningEstimates([airfare,lodging],estimates);
 expect(result).toEqual([airfare,...estimates]);
 expect(result.reduce((sum,item)=>sum+Number(item.amount),0)).toBe(1440);
 expect(mergePlanningEstimates(result,estimates)).toEqual(result);
});
it('preserves a selected hotel and other entered expenses',()=>{
 const hotel={id:'hotel',amount:'',description:'Chosen hotel',merchant:'Chosen hotel'};
 const parking={id:'parking',amount:'75.00',description:'Parking',merchant:''};
 expect(mergePlanningEstimates([hotel,parking],[{...hotel,amount:'570.00'}])).toEqual([{...hotel,amount:'570.00'},parking]);
});
