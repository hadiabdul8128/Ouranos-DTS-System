-- Only the organizer and invited active workspace members can see or join a meeting.
create table ouranos.meetings (
 id uuid primary key,
 organization_id uuid not null references ouranos.organizations(id) on delete cascade,
 organizer_id uuid not null references auth.users(id),
 title text not null check(length(title) between 1 and 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at >= starts_at + interval '1 minute' and ends_at <= starts_at + interval '4 hours'),
 attendee_ids uuid[] not null default '{}' check(cardinality(attendee_ids)<=15),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_at timestamptz not null default now()
);
create index meetings_org_start on ouranos.meetings(organization_id,starts_at);
alter table ouranos.meetings enable row level security;
revoke all on ouranos.meetings from anon,authenticated;
grant select,insert,update on ouranos.meetings to ouranos_api;
create policy meetings_read on ouranos.meetings for select to ouranos_api
 using(ouranos.member_role(organization_id) is not null and (organizer_id=auth.uid() or auth.uid()=any(attendee_ids)));
create policy meetings_create on ouranos.meetings for insert to ouranos_api
 with check(organizer_id=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy meetings_update on ouranos.meetings for update to ouranos_api
 using(organizer_id=auth.uid() and ouranos.member_role(organization_id) is not null)
 with check(organizer_id=auth.uid() and ouranos.member_role(organization_id) is not null);

-- Resolve a supplied address within the caller's workspace without exposing a directory.
-- Keep the existing leader-only team lookup unchanged.
create function ouranos.meeting_member_by_email(org uuid,address text) returns uuid
language sql stable security definer set search_path='' as $$
 select m.user_id from ouranos.memberships m join auth.users u on u.id=m.user_id
 where ouranos.member_role(org) is not null and m.organization_id=org and m.active
 and lower(u.email)=lower(trim(address)) limit 1
$$;
revoke execute on function ouranos.meeting_member_by_email(uuid,text) from public;
grant execute on function ouranos.meeting_member_by_email(uuid,text) to ouranos_api;
