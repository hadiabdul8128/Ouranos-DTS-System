-- Leaders and the service members under them. A leader adds people who are already in
-- the workspace; those people's authorizations then route to that leader, and the leader
-- can follow their travel, payments and assigned checklists without asking.

create table ouranos.team_members(
 organization_id uuid not null references ouranos.organizations(id),
 member_id uuid not null references auth.users(id),
 level text not null check(level in ('s1','command')),
 leader_id uuid not null references auth.users(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(organization_id,member_id,level),
 check(member_id<>leader_id)
);
create index team_members_leader on ouranos.team_members(organization_id,leader_id);
alter table ouranos.team_members enable row level security;
revoke all on ouranos.team_members from anon,authenticated;
grant select,insert,update,delete on ouranos.team_members to ouranos_api;
create policy team_read on ouranos.team_members for select to ouranos_api using(
 ouranos.member_role(organization_id) is not null and (leader_id=auth.uid() or member_id=auth.uid() or ouranos.member_role(organization_id)='admin'));
create policy team_write on ouranos.team_members for all to ouranos_api
 using(leader_id=auth.uid() and ouranos.member_role(organization_id) in ('reviewer','approver','admin'))
 with check(leader_id=auth.uid() and created_by=auth.uid() and ouranos.member_role(organization_id) in ('reviewer','approver','admin'));

-- Payments a traveler records for a trip. Ouranos is not connected to finance.
create table ouranos.trip_payments(
 organization_id uuid not null,
 trip_id uuid not null,
 user_id uuid not null references auth.users(id),
 amount_minor bigint not null check(amount_minor>0 and amount_minor<=100000000000),
 paid_on date not null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,trip_id),
 foreign key(organization_id,trip_id) references ouranos.trips(organization_id,id)
);
alter table ouranos.trip_payments enable row level security;
revoke all on ouranos.trip_payments from anon,authenticated;
grant select,insert,update,delete on ouranos.trip_payments to ouranos_api;
create policy payment_owner on ouranos.trip_payments for all to ouranos_api
 using(user_id=auth.uid() and ouranos.can_edit_trip(organization_id,trip_id))
 with check(user_id=auth.uid() and ouranos.can_edit_trip(organization_id,trip_id));

-- Checklists a leader sends to their people, and each person's progress.
create table ouranos.team_checklists(
 id uuid primary key,
 organization_id uuid not null references ouranos.organizations(id),
 leader_id uuid not null references auth.users(id),
 title text not null check(length(title) between 1 and 120),
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 40),
 due_on date,
 created_at timestamptz not null default now()
);
create table ouranos.checklist_assignments(
 checklist_id uuid not null references ouranos.team_checklists(id) on delete cascade,
 organization_id uuid not null references ouranos.organizations(id),
 member_id uuid not null references auth.users(id),
 done_step_ids jsonb not null default '[]' check(jsonb_typeof(done_step_ids)='array'),
 updated_at timestamptz not null default now(),
 primary key(checklist_id,member_id)
);
create index checklist_assignments_member on ouranos.checklist_assignments(organization_id,member_id);

-- Helpers keep the two tables' policies from querying each other recursively.
create function ouranos.is_checklist_leader(checklist uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from ouranos.team_checklists where id=checklist and leader_id=auth.uid()) $$;
create function ouranos.is_checklist_assignee(checklist uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from ouranos.checklist_assignments where checklist_id=checklist and member_id=auth.uid()) $$;
revoke execute on function ouranos.is_checklist_leader(uuid),ouranos.is_checklist_assignee(uuid) from public;
grant execute on function ouranos.is_checklist_leader(uuid),ouranos.is_checklist_assignee(uuid) to ouranos_api;

alter table ouranos.team_checklists enable row level security;
alter table ouranos.checklist_assignments enable row level security;
revoke all on ouranos.team_checklists,ouranos.checklist_assignments from anon,authenticated;
grant select,insert,delete on ouranos.team_checklists to ouranos_api;
grant select,insert,update,delete on ouranos.checklist_assignments to ouranos_api;
create policy checklist_read on ouranos.team_checklists for select to ouranos_api using(
 ouranos.member_role(organization_id) is not null and (leader_id=auth.uid() or ouranos.is_checklist_assignee(id)));
create policy checklist_create on ouranos.team_checklists for insert to ouranos_api with check(
 leader_id=auth.uid() and ouranos.member_role(organization_id) in ('reviewer','approver','admin'));
create policy checklist_remove on ouranos.team_checklists for delete to ouranos_api using(leader_id=auth.uid());
create policy assignment_read on ouranos.checklist_assignments for select to ouranos_api using(
 ouranos.member_role(organization_id) is not null and (member_id=auth.uid() or ouranos.is_checklist_leader(checklist_id)));
create policy assignment_create on ouranos.checklist_assignments for insert to ouranos_api with check(
 ouranos.is_checklist_leader(checklist_id) and exists(select 1 from ouranos.team_members t where t.organization_id=checklist_assignments.organization_id and t.member_id=checklist_assignments.member_id and t.leader_id=auth.uid()));
create policy assignment_progress on ouranos.checklist_assignments for update to ouranos_api
 using(member_id=auth.uid()) with check(member_id=auth.uid());
create policy assignment_remove on ouranos.checklist_assignments for delete to ouranos_api using(ouranos.is_checklist_leader(checklist_id));

-- A workspace member found by email, for leaders adding their people. Only active
-- members of the same workspace are found, so it cannot be used to probe other accounts.
create function ouranos.member_by_email(org uuid,address text) returns uuid language sql stable security definer set search_path='' as $$
 select m.user_id from ouranos.memberships m join auth.users u on u.id=m.user_id
 where ouranos.member_role(org) in ('reviewer','approver','admin') and m.organization_id=org and m.active and lower(u.email)=lower(trim(address)) limit 1 $$;

-- The caller's people (or everyone's, for an admin) with their email addresses.
create function ouranos.team_people(org uuid) returns table(member_id uuid,email text,level text,leader_id uuid,role text) language sql stable security definer set search_path='' as $$
 select t.member_id,u.email::text,t.level,t.leader_id,m.role from ouranos.team_members t
 join auth.users u on u.id=t.member_id left join ouranos.memberships m on m.organization_id=t.organization_id and m.user_id=t.member_id
 where t.organization_id=org and ouranos.member_role(org) is not null and (t.leader_id=auth.uid() or ouranos.member_role(org)='admin') $$;

-- The caller's own S1 and command, with their email addresses.
create function ouranos.my_leaders(org uuid) returns table(level text,leader_id uuid,email text) language sql stable security definer set search_path='' as $$
 select t.level,t.leader_id,u.email::text from ouranos.team_members t join auth.users u on u.id=t.leader_id
 where t.organization_id=org and t.member_id=auth.uid() and ouranos.member_role(org) is not null $$;

-- Travel records of the caller's people only, for the leader overview. Rows are not added
-- to anyone's sync, so a leader's own trip list stays their own.
create function ouranos.team_records(org uuid) returns table(kind text,id uuid,trip_id uuid,traveler_id uuid,status text,data jsonb,updated_at timestamptz) language sql stable security definer set search_path='' as $$
 with people as (select distinct member_id from ouranos.team_members where organization_id=org and leader_id=auth.uid() and ouranos.member_role(org) is not null),
 trips as (select t.* from ouranos.trips t where t.organization_id=org and t.traveler_id in (select member_id from people))
 select 'trip',t.id,t.id,t.traveler_id,t.status,t.data,t.updated_at from trips t
 union all select 'authorization',a.id,a.trip_id,t.traveler_id,a.status,a.data,a.updated_at from ouranos.authorizations a join trips t on t.id=a.trip_id where a.organization_id=org
 union all select 'voucher',v.id,v.trip_id,t.traveler_id,v.status,'{}'::jsonb,v.updated_at from ouranos.vouchers v join trips t on t.id=v.trip_id where v.organization_id=org
 union all select 'expense',e.id,e.trip_id,t.traveler_id,e.status,jsonb_build_object('amountMinor',e.data->'amountMinor','currency',e.data->'currency','category',e.data->'category'),e.updated_at from ouranos.expenses e join trips t on t.id=e.trip_id where e.organization_id=org
 union all select 'approval',r.id,r.trip_id,t.traveler_id,r.status,r.data,r.updated_at from ouranos.approval_requests r join trips t on t.id=r.trip_id where r.organization_id=org
 union all select 'payment',p.trip_id,p.trip_id,p.user_id,'paid',jsonb_build_object('amountMinor',p.amount_minor,'date',p.paid_on),p.updated_at from ouranos.trip_payments p join trips t on t.id=p.trip_id where p.organization_id=org
 union all select 'assignment',a.checklist_id,null,a.member_id,'assigned',jsonb_build_object('title',c.title,'stepCount',jsonb_array_length(c.steps),'doneCount',jsonb_array_length(a.done_step_ids),'dueOn',c.due_on),a.updated_at
  from ouranos.checklist_assignments a join ouranos.team_checklists c on c.id=a.checklist_id where a.organization_id=org and c.leader_id=auth.uid() and a.member_id in (select member_id from people) $$;

-- Team routing needs a routing record for the request's reference; reuse the workspace's
-- or create an empty one. Only steps from the chain of command are ever used.
create function ouranos.routing_workflow(org uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare found uuid;
 begin
  if ouranos.member_role(org) is null then raise exception 'Membership required'; end if;
  select id into found from ouranos.workflow_definitions where organization_id=org and kind='authorization';
  if found is null then
   insert into ouranos.workflow_definitions(id,organization_id,kind,data,created_by)
   values(gen_random_uuid(),org,'authorization',jsonb_build_object('kind','authorization','name','Chain of command','steps','[]'::jsonb),auth.uid())
   returning id into found;
  end if;
  return found;
 end $$;

revoke execute on function ouranos.member_by_email(uuid,text),ouranos.team_people(uuid),ouranos.my_leaders(uuid),ouranos.team_records(uuid),ouranos.routing_workflow(uuid) from public;
grant execute on function ouranos.member_by_email(uuid,text),ouranos.team_people(uuid),ouranos.my_leaders(uuid),ouranos.team_records(uuid),ouranos.routing_workflow(uuid) to ouranos_api;
