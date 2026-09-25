import {describe,expect,it} from 'vitest';
import {approvedTravel,suggestReceiptAllocation,type ApprovedRevision} from '../../packages/domain/voucher-adapter';
import type {PlannedExpense} from '../../packages/contracts/planning-module';

function revision(items:PlannedExpense[]):ApprovedRevision{
  return {
    id:crypto.randomUUID(),sha256:'test',snapshot:{
      entity:{id:crypto.randomUUID(),data:{formSchemaVersion:'ouranos.planning.v1',formData:{traveler:'Alex Morgan',origin:'Raleigh, NC',currency:'USD',approvedExpenseItems:items}}},
      trip:{id:crypto.randomUUID(),data:{destination:'San Diego, CA',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'TDY'}},
    },
  } as unknown as ApprovedRevision;
}

describe('connected Voucher receipt allocation',()=>{
  it('normalizes an approved planning revision and matches a hotel folio with an overage',()=>{
    const hotelId=crypto.randomUUID();
    const approved=revision([{id:hotelId,category:'lodging',description:'Marriott lodging',authorizedAmountMinor:57000,merchant:'Marriott',startDate:'2026-10-12',endDate:'2026-10-15'}]);
    expect(approvedTravel(approved).authorizedItems[0].amount).toBe(570);
    const match=suggestReceiptAllocation(approved,{
      merchant:'Marriott',date:'2026-10-15',amount:'621.00',
      rawText:'Marriott San Diego\nCheck-in 2026-10-12\nCheck-out 2026-10-15\nTotal $621.00',
    });
    expect(match.authorizationItemId).toBe(hotelId);
    expect(match.category).toBe('lodging');
    expect(match.confidence).toBe('high');
  });

  it('uses a simple hint to match rental car fuel',()=>{
    const fuelId=crypto.randomUUID();
    const approved=revision([
      {id:crypto.randomUUID(),category:'rental_car',description:'Hertz rental',authorizedAmountMinor:28000},
      {id:fuelId,category:'fuel',description:'Rental car fuel',authorizedAmountMinor:6800},
    ]);
    const match=suggestReceiptAllocation(approved,{merchant:'Fuel Stop',date:'2026-10-13',amount:'68.00'},'rental car gas');
    expect(match.authorizationItemId).toBe(fuelId);
    expect(match.category).toBe('fuel');
  });

  it('leaves a tie unassigned and never uses an uncertain OCR total to break it',()=>{
    const approved=revision([
      {id:crypto.randomUUID(),category:'parking',description:'Parking A',authorizedAmountMinor:7500},
      {id:crypto.randomUUID(),category:'parking',description:'Parking B',authorizedAmountMinor:9200},
    ]);
    const match=suggestReceiptAllocation(approved,{merchant:'Parking',amount:'',rawText:'Parking\nTotal $92.00'},'parking');
    expect(match.authorizationItemId).toBe('');
    expect(match.confidence).toBe('review');
  });
});
