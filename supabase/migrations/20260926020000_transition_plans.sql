-- Transition records are personal. They are not trip records or organization-wide
-- sync entities. Even a colleague with administrator access cannot read them.
create table ouranos.transition_plans (
 id uuid primary key,
 organization_id uuid not null references ouranos.organizations(id),
 user_id uuid not null references auth.users(id),
 version integer not null check(version>0),
 profile jsonb not null check(jsonb_typeof(profile)='object'),
 recommendation jsonb not null check(jsonb_typeof(recommendation)='object'),
 selected_path text check(selected_path in ('employment','training','education')),
 completed_action_ids jsonb not null default '[]' check(jsonb_typeof(completed_action_ids)='array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
alter table ouranos.transition_plans enable row level security;
revoke all on ouranos.transition_plans from anon,authenticated;
grant select,insert,update on ouranos.transition_plans to ouranos_api;
create policy transition_owner on ouranos.transition_plans for all to ouranos_api
 using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null)
 with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
-- The worker does not need access. API reads and writes run with the verified
-- actor's identity; no service-role reads, shared change_log, or public RPCs.
