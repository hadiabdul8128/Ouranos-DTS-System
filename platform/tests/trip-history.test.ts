import {describe,expect,it} from 'vitest';
import {historyTotals,tripHistory} from '../../packages/domain/trip-history';
import type {Entity} from '../../packages/contracts';

const today='2026-09-30';
let n=0;
const row=(kind:Entity['kind'],data:Record<string,unknown>,extra:Partial<Entity>={}):Entity=>({id:`${kind}-${++n}`,organizationId:'o',kind,version:1,status:'draft',data,updatedAt:`2026-09-${String(10+n).padStart(2,'0')}T00:00:00Z`,...extra});

describe('trip history',()=>{
 const past=row('trip',{destination:'Denver, CO',departure:'2026-08-03',returnDate:'2026-08-07',purpose:'Training'},{id:'past'});
 const next=row('trip',{destination:'Seattle, WA',departure:'2026-12-05',returnDate:'2026-12-08',purpose:'Conference'},{id:'next'});
 const entities=[past,next,
  row('authorization',{formData:{approvedExpenseItems:[{category:'airfare',authorizedAmountMinor:40000},{category:'lodging',authorizedAmountMinor:60000}]}},{tripId:'past',status:'approved'}),
  row('expense',{amountMinor:38000,currency:'USD',category:'airfare'},{tripId:'past'}),
  row('expense',{amountMinor:57500,currency:'USD',category:'lodging'},{tripId:'past'}),
  row('expense',{amountMinor:2000,currency:'EUR',category:'meals'},{tripId:'past'}),
  row('voucher',{},{tripId:'past',status:'verified'}),
 ];
 it('shows planned and claimed amounts, newest trip first',()=>{
  const [upcoming,done]=tripHistory(entities,{},today);
  expect(upcoming).toMatchObject({id:'next',phase:'upcoming',plannedMinor:null,claimedMinor:null,payStatus:'not_due'});
  expect(done).toMatchObject({id:'past',phase:'past',nights:4,plannedMinor:100000,claimedMinor:95500,expenseCount:3,foreignExpenseCount:1,planStatus:'approved',voucherStatus:'verified',payStatus:'awaiting'});
  expect(done!.categories).toEqual([{category:'lodging',plannedMinor:60000,claimedMinor:57500},{category:'airfare',plannedMinor:40000,claimedMinor:38000}]);
 });
 it('marks recorded payments and past trips without a voucher',()=>{
  const paid=tripHistory(entities,{past:{amountMinor:95500,date:'2026-08-20'}},today);
  expect(paid[1]).toMatchObject({payStatus:'paid',payment:{amountMinor:95500,date:'2026-08-20'}});
  const unfiled=tripHistory([past],{},today);
  expect(unfiled[0]!.payStatus).toBe('not_filed');
 });
 it('totals what was planned, claimed, paid and still owed',()=>{
  expect(historyTotals(tripHistory(entities,{},today))).toEqual({trips:2,nights:7,plannedMinor:100000,claimedMinor:95500,paidMinor:0,awaitingMinor:95500});
  expect(historyTotals(tripHistory(entities,{past:{amountMinor:95500,date:'2026-08-20'}},today))).toMatchObject({paidMinor:95500,awaitingMinor:0});
 });
});
