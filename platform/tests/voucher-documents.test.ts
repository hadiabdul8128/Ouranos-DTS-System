import {describe,expect,it} from 'vitest';
import {documentProgress,voucherDocuments} from '../../packages/domain/voucher-documents';

describe('voucher documents',()=>{
 it('always asks for orders and receipts, and adds only what the trip needs',()=>{
  expect(voucherDocuments({expenses:[],missingReceipts:[]}).map(d=>d.id)).toEqual(['orders','receipts','fcal']);
  const ids=voucherDocuments({travelMode:'pov',expenses:[{category:'lodging',merchant:'Hilton',foreignCurrency:false},{category:'meals',merchant:'Café',foreignCurrency:true}],missingReceipts:[]}).map(d=>d.id);
  expect(ids).toEqual(['orders','receipts','ctw','non_availability','fcal','foreign_statement']);
 });
 it('checks receipts itself and names what is missing',()=>{
  const [,receipts]=voucherDocuments({expenses:[{category:'airfare',merchant:'Delta',foreignCurrency:false}],missingReceipts:['Delta']});
  expect(receipts!.auto).toEqual({done:false,note:'Still missing: Delta'});
 });
 it('counts ticked, not-applicable and auto-checked items as ready',()=>{
  const docs=voucherDocuments({expenses:[{category:'lodging',merchant:'Hilton',foreignCurrency:false}],missingReceipts:[]});
  expect(documentProgress(docs,{})).toEqual({ready:1,total:4,complete:false});
  expect(documentProgress(docs,{orders:'done',non_availability:'na',fcal:'na'})).toEqual({ready:4,total:4,complete:true});
 });
});
