import {z} from 'zod';
export const meetingInput=z.object({
 organizationId:z.string().uuid(),title:z.string().trim().min(1).max(120),
 startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}),
 attendeeEmails:z.array(z.string().trim().email().max(254)).max(15).default([]),
}).strict().refine(b=>Date.parse(b.endsAt)>Date.parse(b.startsAt)&&Date.parse(b.endsAt)-Date.parse(b.startsAt)<=4*60*60*1000,{message:'Meetings must last between 1 minute and 4 hours',path:['endsAt']}).refine(b=>Date.parse(b.endsAt)-Date.parse(b.startsAt)>=60000,{message:'Meetings must last at least 1 minute',path:['endsAt']});
export const meetingQuery=z.object({organizationId:z.string().uuid()}).strict();
export type MeetingInput=z.infer<typeof meetingInput>;
export type Meeting={id:string;organizationId:string;organizerId:string;title:string;startsAt:string;endsAt:string;attendeeIds:string[];status:'scheduled'|'cancelled';createdAt:string};
export type MeetingsResponse={meetings:Meeting[];callingEnabled:boolean};
export type MeetingConnection={token:string;serverUrl:string};
