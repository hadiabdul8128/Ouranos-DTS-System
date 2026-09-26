import {describe,it,expect} from 'vitest';
import {commandSchema,tripInput,expenseInput} from '../../packages/contracts/index';
import {canonical} from '../api/commands';
import {sniffType} from '../shared/files';
import {parseAmountMinor} from '../../packages/contracts/planning-module';
describe('shared contract boundary',()=>{
 it('rejects reverse travel dates and impossible dates',()=>{expect(tripInput.safeParse({destination:'Boston',purpose:'Test',departure:'2026-10-12',returnDate:'2026-10-11'}).success).toBe(false);expect(tripInput.safeParse({destination:'Boston',purpose:'Test',departure:'2026-02-30',returnDate:'2026-03-02'}).success).toBe(false)});
 it('rejects fractional money and unsupported fields',()=>{expect(expenseInput.safeParse({tripId:crypto.randomUUID(),merchant:'Hotel',incurredOn:'2026-10-12',amountMinor:182.5,currency:'USD',category:'lodging'}).success).toBe(false);expect(commandSchema.safeParse({type:'trip.save',actorId:crypto.randomUUID()}).success).toBe(false)});
 it('canonicalizes payload key order for safe retries',()=>expect(canonical({b:2,a:{z:3,x:4}})).toBe(canonical({a:{x:4,z:3},b:2})));
 it('detects file content independently of its extension',()=>{expect(sniffType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');expect(sniffType(Buffer.from('<script>bad</script>'))).toBeNull()});
 it('accepts grouped dollar amounts without dropping them from the budget',()=>{expect(parseAmountMinor('1,300.00')).toBe(130000);expect(parseAmountMinor('130.00')).toBe(13000);expect(()=>parseAmountMinor('1,30.00')).toThrow()});
});
