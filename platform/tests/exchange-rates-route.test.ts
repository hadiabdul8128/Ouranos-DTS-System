import {expect,it,vi} from 'vitest';
import {GET} from '../../app/api/exchange-rates/route';
it('returns an uncached actionable error when the exchange rate provider fails',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('timeout')));
 try{const response=await GET();expect(response.status).toBe(503);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.json()).toHaveProperty('error')}finally{vi.unstubAllGlobals()}
});
