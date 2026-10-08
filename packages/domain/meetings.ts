import type {Meeting} from '../contracts/meetings';
/** Join opens 15 minutes before a scheduled start and closes at its end. */
export function canJoinMeeting(meeting:Meeting,now=Date.now()){
 return meeting.status==='scheduled'&&now>=Date.parse(meeting.startsAt)-15*60000&&now<Date.parse(meeting.endsAt);
}
export function meetingRoomName(meeting:Pick<Meeting,'id'|'organizationId'>){return `ouranos-${meeting.organizationId}-${meeting.id}`}
export function meetingParticipants(emails:string[]){return [...new Set(emails.map(email=>email.trim().toLowerCase()).filter(Boolean))]}
