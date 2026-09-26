-- A system verification is a frozen finding about one submitted voucher revision.
-- It is deliberately separate from human approval decisions and DTS delivery.
alter table ouranos.vouchers drop constraint if exists vouchers_status_check;
alter table ouranos.vouchers add constraint vouchers_status_check
 check (status in ('draft','in_review','approved','changes_requested','rejected','verified','needs_action'));

create table ouranos.voucher_verifications (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 trip_id uuid not null,
 voucher_id uuid not null,
 revision_id uuid not null,
 result text not null check (result in ('verified','needs_action')),
 rule_version text not null,
 snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 report jsonb not null check (jsonb_typeof(report) = 'object'),
 created_at timestamptz not null default now(),
 unique (revision_id),
 foreign key (organization_id,trip_id) references ouranos.trips(organization_id,id),
 foreign key (organization_id,voucher_id) references ouranos.vouchers(organization_id,id),
 foreign key (organization_id,revision_id) references ouranos.submission_revisions(organization_id,id)
);
create index voucher_verifications_latest on ouranos.voucher_verifications(organization_id,voucher_id,created_at desc);
create trigger immutable_voucher_verification before update or delete on ouranos.voucher_verifications
 for each row execute function ouranos.prevent_history_change();

alter table ouranos.voucher_verifications enable row level security;
revoke all on ouranos.voucher_verifications from anon,authenticated;
grant select on ouranos.voucher_verifications to authenticated;
grant select,insert on ouranos.voucher_verifications to ouranos_api;
create policy voucher_verification_read on ouranos.voucher_verifications for select to authenticated,ouranos_api
 using (ouranos.can_view_trip(organization_id,trip_id));
create policy voucher_verification_insert on ouranos.voucher_verifications for insert to ouranos_api
 with check (ouranos.can_edit_trip(organization_id,trip_id));
