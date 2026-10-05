-- Private cross-device state for preferences and lightweight workspace tools.
-- Large travel records and receipts continue to use their dedicated versioned tables.
create table ouranos.personal_state(
 organization_id uuid not null references ouranos.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check(key in ('planner','preferences','voucher_documents')),
 value jsonb not null default '{}' check(jsonb_typeof(value)='object' and pg_column_size(value)<=262144),
 updated_at timestamptz not null default now(),
 primary key(organization_id,user_id,key)
);

alter table ouranos.personal_state enable row level security;
revoke all on ouranos.personal_state from anon,authenticated;
grant select,insert,update,delete on ouranos.personal_state to ouranos_api;
create policy personal_state_owner on ouranos.personal_state for all to ouranos_api
 using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null)
 with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
