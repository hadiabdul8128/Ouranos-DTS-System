-- Keep Ouranos tables separate when sharing a paid Supabase project with another app.
-- ALTER preserves data, foreign keys, RLS policies, grants and owned sequences.
alter table public.organizations set schema ouranos;
alter table public.memberships set schema ouranos;
alter table public.devices set schema ouranos;
alter table public.trips set schema ouranos;
alter table public.authorizations set schema ouranos;
alter table public.expenses set schema ouranos;
alter table public.vouchers set schema ouranos;
alter table public.documents set schema ouranos;
alter table public.document_links set schema ouranos;
alter table public.workflow_definitions set schema ouranos;
alter table public.submission_revisions set schema ouranos;
alter table public.approval_requests set schema ouranos;
alter table public.approval_steps set schema ouranos;
alter table public.approval_decisions set schema ouranos;
alter table public.extraction_runs set schema ouranos;
alter table public.notifications set schema ouranos;
alter table public.integration_deliveries set schema ouranos;
alter table public.processed_commands set schema ouranos;
alter table public.change_log set schema ouranos;
alter table public.audit_events set schema ouranos;
alter table public.job_results set schema ouranos;
alter table public.failed_jobs set schema ouranos;

create or replace function ouranos.member_role(org uuid) returns text language sql stable security definer set search_path='' as $$ select role from ouranos.memberships where organization_id=org and user_id=auth.uid() and active $$;
create or replace function ouranos.can_view_trip(org uuid,trip uuid) returns boolean language sql stable security definer set search_path='' as $$
 select ouranos.member_role(org) is not null and exists(select 1 from ouranos.trips t where t.organization_id=org and t.id=trip and (t.traveler_id=auth.uid() or ouranos.member_role(org) in ('admin','auditor') or exists(select 1 from ouranos.approval_requests r join ouranos.approval_steps s on s.request_id=r.id where r.organization_id=org and r.trip_id=trip and s.assignee_id=auth.uid())))
$$;
create or replace function ouranos.can_edit_trip(org uuid,trip uuid) returns boolean language sql stable security definer set search_path='' as $$ select ouranos.member_role(org) is not null and exists(select 1 from ouranos.trips where organization_id=org and id=trip and traveler_id=auth.uid()) $$;
revoke all on all functions in schema ouranos from public;
grant execute on function ouranos.member_role(uuid),ouranos.can_view_trip(uuid,uuid),ouranos.can_edit_trip(uuid,uuid) to authenticated,ouranos_api;

-- Bootstrap creates only the caller's own new tenant, and is deliberately not
-- exposed as a Supabase RPC to browser roles.
create or replace function ouranos.create_organization(new_id uuid,org_name text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into ouranos.organizations(id,name,created_by) values(new_id,org_name,auth.uid());
 insert into ouranos.memberships(organization_id,user_id,role) values(new_id,auth.uid(),'admin');
 return new_id;
end $$;
revoke all on function ouranos.create_organization(uuid,text) from public;
grant execute on function ouranos.create_organization(uuid,text) to ouranos_api;


-- The worker can access this application's rows without a traveler identity.
-- Its dedicated login receives this role, not postgres or a global RLS bypass.
do $$ begin create role ouranos_worker nologin nobypassrls; exception when duplicate_object then null; end $$;
grant usage on schema ouranos, pgmq to ouranos_worker;
grant usage,select on all sequences in schema ouranos to ouranos_worker;
do $$ declare tbl text;begin
 foreach tbl in array array['organizations','memberships','devices','trips','authorizations','expenses','vouchers','documents','document_links','workflow_definitions','submission_revisions','approval_requests','approval_steps','approval_decisions','extraction_runs','notifications','integration_deliveries','processed_commands','change_log','audit_events','job_results','failed_jobs'] loop
  execute format('grant select,insert,update on ouranos.%I to ouranos_worker',tbl);
  execute format('create policy worker_access on ouranos.%I for all to ouranos_worker using(true) with check(true)',tbl);
 end loop;
end $$;
grant select,insert,update,delete on pgmq.q_ouranos_jobs,pgmq.a_ouranos_jobs to ouranos_worker;
grant usage,select on sequence pgmq.q_ouranos_jobs_msg_id_seq to ouranos_worker;
do $$ declare signature text;begin
 for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pgmq' and p.proname in ('read','archive','set_vt') loop
  execute format('grant execute on function %s to ouranos_worker',signature);
 end loop;
end $$;
grant ouranos_worker to postgres;
