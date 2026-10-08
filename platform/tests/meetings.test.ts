import {describe,it,expect} from 'vitest';
import {meetingInput,type Meeting} from '../../packages/contracts/meetings';
import {canJoinMeeting,meetingRoomName,meetingParticipants} from '../../packages/domain/meetings';
const base={organizationId:'00000000-0000-4000-8000-000000000001',title:'Check-in',startsAt:'2026-10-08T16:00:00Z',endsAt:'2026-10-08T16:30:00Z',attendeeEmails:[]};
const m:Meeting={...base,id:'00000000-0000-4000-8000-000000000002',organizerId:'00000000-0000-4000-8000-000000000003',attendeeIds:[],status:'scheduled',createdAt:base.startsAt};
describe('meeting validation and admission',()=>{
 it('opens 15 minutes early and closes at the scheduled end',()=>{expect(canJoinMeeting(m,Date.parse('2026-10-08T15:44:59Z'))).toBe(false);expect(canJoinMeeting(m,Date.parse('2026-10-08T15:45:00Z'))).toBe(true);expect(canJoinMeeting(m,Date.parse(base.endsAt))).toBe(false)});
 it('never admits a cancelled meeting',()=>expect(canJoinMeeting({...m,status:'cancelled'},Date.parse(base.startsAt))).toBe(false));
 it('limits duration and attendee counts',()=>{expect(meetingInput.safeParse(base).success).toBe(true);expect(meetingInput.safeParse({...base,endsAt:base.startsAt}).success).toBe(false);expect(meetingInput.safeParse({...base,endsAt:'2026-10-08T21:00:00Z'}).success).toBe(false);expect(meetingInput.safeParse({...base,attendeeEmails:Array(16).fill('member@example.com')}).success).toBe(false)});
 it('deduplicates normalized emails',()=>expect(meetingParticipants([' Member@example.com ','member@example.com'])).toEqual(['member@example.com']));
 it('names rooms with both workspace and meeting identity',()=>expect(meetingRoomName(m)).toBe(`ouranos-${m.organizationId}-${m.id}`));
});
