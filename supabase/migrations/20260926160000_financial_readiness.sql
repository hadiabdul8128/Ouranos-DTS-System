-- Personal planning data is excluded from shared travel entities and workers.
create table ouranos.financial_plans (
 id uuid primary key,
 organization_id uuid not null references ouranos.organizations(id),
 user_id uuid not null references auth.users(id),
 version integer not null check(version>0),
 profile jsonb not null check(jsonb_typeof(profile)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id),
 unique(id,organization_id,user_id)
);
create table ouranos.financial_check_ins (
 plan_id uuid not null,
 organization_id uuid not null,
 user_id uuid not null,
 month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 updated_at timestamptz not null default now(),
 primary key(plan_id,month),
 foreign key(plan_id,organization_id,user_id) references ouranos.financial_plans(id,organization_id,user_id)
);
alter table ouranos.financial_plans enable row level security;
alter table ouranos.financial_check_ins enable row level security;
revoke all on ouranos.financial_plans,ouranos.financial_check_ins from public,anon,authenticated;
grant select,insert,update on ouranos.financial_plans,ouranos.financial_check_ins to ouranos_api;
create policy financial_owner on ouranos.financial_plans for all to ouranos_api
 using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null)
 with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy financial_check_in_owner on ouranos.financial_check_ins for all to ouranos_api
 using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null)
 with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
