import {afterEach,describe,expect,it,vi} from 'vitest';
import {readConfig} from '../shared/config';

afterEach(()=>vi.unstubAllEnvs());

function configure(nodeEnv:'production'|'development',mode:'required'|'preview'|'automatic'){
 for(const [key,value] of Object.entries({
  NODE_ENV:nodeEnv,APPROVAL_MODE:mode,DATABASE_URL:'postgres://test:test@localhost/test',DATABASE_SSL:'verify-full',
  SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public',SUPABASE_SECRET_KEY:'test-secret',
  DTS_PROVIDER:'disabled',OCR_PROVIDER:'disabled',SCAN_PROVIDER:'disabled',BOOKING_DEMAND_MODE:'production',
 }))vi.stubEnv(key,value);
 vi.stubEnv('BOOKING_DEMAND_API_KEY',undefined);vi.stubEnv('BOOKING_DEMAND_AFFILIATE_ID',undefined);
 return readConfig();
}

describe('Authorization approval deployment policy',()=>{
 it.each(['required','preview','automatic'] as const)('requires human approval in production with a %s environment value',mode=>{
  expect(configure('production',mode).APPROVAL_MODE).toBe('required');
 });
 it.each(['required','preview','automatic'] as const)('preserves the explicit %s development mode',mode=>{
  expect(configure('development',mode).APPROVAL_MODE).toBe(mode);
 });
});
