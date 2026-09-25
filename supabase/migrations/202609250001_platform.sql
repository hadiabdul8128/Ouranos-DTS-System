-- Ouranos platform foundation. All ordinary API writes use ouranos_api + an
-- authenticated actor inside a transaction. Data API users get SELECT only.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq;
create schema if not exists ouranos;
revoke all on schema ouranos from public, anon;
do $$ begin create role ouranos_api nologin nobypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, ouranos, auth to ouranos_api;
grant usage on schema ouranos to authenticated;
grant execute on function auth.uid() to ouranos_api;

create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.memberships(organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('traveler','reviewer','approver','admin','auditor')),active boolean not null default true,primary key(organization_id,user_id));
create table public.devices(id uuid not null,organization_id uuid not null,user_id uuid not null,last_seen_at timestamptz not null default now(),primary key(organization_id,id),foreign key(organization_id,user_id) references public.memberships(organization_id,user_id));
create table public.trips(id uuid primary key,organization_id uuid not null references public.organizations(id),traveler_id uuid not null references auth.users(id),data jsonb not null check(jsonb_typeof(data)='object'),status text not null default 'draft' check(status in ('draft','active','completed','cancelled')),version integer not null default 1 check(version>0),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id));
create table public.authorizations(id uuid primary key,organization_id uuid not null,trip_id uuid not null,data jsonb not null check(jsonb_typeof(data)='object'),status text not null default 'draft' check(status in ('draft','in_review','approved','changes_requested','rejected')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,trip_id) references public.trips(organization_id,id));
create table public.expenses(id uuid primary key,organization_id uuid not null,trip_id uuid not null,data jsonb not null check(jsonb_typeof(data)='object'),status text not null default 'draft' check(status in ('draft','confirmed')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,trip_id) references public.trips(organization_id,id),check((data->>'amountMinor')::numeric>=0),check((data->>'currency')~'^[A-Z]{3}$'));
create table public.vouchers(id uuid primary key,organization_id uuid not null,trip_id uuid not null,authorization_id uuid not null,data jsonb not null check(jsonb_typeof(data)='object'),status text not null default 'draft' check(status in ('draft','in_review','approved','changes_requested','rejected')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,trip_id) references public.trips(organization_id,id),foreign key(organization_id,authorization_id) references public.authorizations(organization_id,id));
create table public.documents(id uuid primary key,organization_id uuid not null,trip_id uuid not null,data jsonb not null check(jsonb_typeof(data)='object'),storage_key text not null unique,status text not null default 'registered' check(status in ('registered','uploaded','awaiting_provider','processing','needs_review','ready','quarantined','failed')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,trip_id) references public.trips(organization_id,id));
create table public.document_links(organization_id uuid not null,document_id uuid not null,expense_id uuid not null,primary key(document_id,expense_id),foreign key(organization_id,document_id) references public.documents(organization_id,id),foreign key(organization_id,expense_id) references public.expenses(organization_id,id));
create table public.workflow_definitions(id uuid primary key,organization_id uuid not null references public.organizations(id),kind text not null check(kind in ('authorization','voucher')),data jsonb not null,status text not null default 'active',version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,kind),unique(organization_id,id));
create table public.submission_revisions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,trip_id uuid not null,authorization_id uuid,voucher_id uuid,entity_version integer not null,snapshot jsonb not null,sha256 text not null,submitted_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,id),check(num_nonnulls(authorization_id,voucher_id)=1),foreign key(organization_id,trip_id) references public.trips(organization_id,id),foreign key(organization_id,authorization_id) references public.authorizations(organization_id,id),foreign key(organization_id,voucher_id) references public.vouchers(organization_id,id));
create table public.approval_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null,trip_id uuid not null,revision_id uuid not null,workflow_id uuid not null,workflow_version integer not null,data jsonb not null,status text not null default 'in_review' check(status in ('in_review','approved','changes_requested','rejected')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,trip_id) references public.trips(organization_id,id),foreign key(organization_id,revision_id) references public.submission_revisions(organization_id,id),foreign key(organization_id,workflow_id) references public.workflow_definitions(organization_id,id));
create table public.approval_steps(id uuid primary key default gen_random_uuid(),organization_id uuid not null,request_id uuid not null,position integer not null,assignee_id uuid not null references auth.users(id),required_role text not null check(required_role in ('reviewer','approver')),status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected')),unique(request_id,position),foreign key(organization_id,request_id) references public.approval_requests(organization_id,id));
create table public.approval_decisions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,request_id uuid not null,step_id uuid not null unique references public.approval_steps(id),actor_id uuid not null references auth.users(id),decision text not null check(decision in ('approved','changes_requested','rejected')),comment text not null default '',created_at timestamptz not null default now(),foreign key(organization_id,request_id) references public.approval_requests(organization_id,id));
create table public.extraction_runs(id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,provider text not null,model_version text not null,result jsonb not null,created_at timestamptz not null default now(),foreign key(organization_id,document_id) references public.documents(organization_id,id));
create table public.notifications(id uuid primary key default gen_random_uuid(),organization_id uuid not null,user_id uuid not null references auth.users(id),trip_id uuid,data jsonb not null,status text not null default 'unread' check(status in ('unread','read')),version integer not null default 1,updated_at timestamptz not null default now(),created_at timestamptz not null default now(),foreign key(organization_id,trip_id) references public.trips(organization_id,id));
create table public.integration_deliveries(id uuid primary key default gen_random_uuid(),organization_id uuid not null,trip_id uuid not null,revision_id uuid not null,provider text not null default 'dts',data jsonb not null,status text not null default 'queued' check(status in ('queued','disabled','simulated','accepted','rejected','unknown','failed')),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(revision_id,provider),foreign key(organization_id,trip_id) references public.trips(organization_id,id),foreign key(organization_id,revision_id) references public.submission_revisions(organization_id,id));
create table public.processed_commands(organization_id uuid not null,user_id uuid not null,command_id uuid not null,payload_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(organization_id,command_id));
create table public.change_log(cursor bigint generated always as identity primary key,organization_id uuid not null,trip_id uuid,kind text not null,entity_id uuid not null,operation text not null default 'upsert' check(operation in ('upsert','delete')),entity jsonb,created_at timestamptz not null default now());
create table public.audit_events(id bigint generated always as identity primary key,organization_id uuid not null,trip_id uuid,actor_id uuid,command_id uuid,action text not null,entity_id uuid not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.job_results(job_key text primary key,result jsonb not null,completed_at timestamptz not null default now());
create table public.failed_jobs(id bigint generated always as identity primary key,message jsonb not null,error_code text not null,created_at timestamptz not null default now());

create index trips_org_traveler on public.trips(organization_id,traveler_id);
create index change_log_org_cursor on public.change_log(organization_id,cursor);
create index audit_org_trip on public.audit_events(organization_id,trip_id,id);
create index approval_steps_assignee on public.approval_steps(assignee_id,request_id);
create index documents_trip on public.documents(organization_id,trip_id);
create index expenses_trip on public.expenses(organization_id,trip_id);
create index authorizations_trip on public.authorizations(organization_id,trip_id);
create index vouchers_trip on public.vouchers(organization_id,trip_id);

-- SECURITY DEFINER helpers avoid recursive membership/assignment policies.
-- They never accept an actor argument: identity comes from the verified API JWT.
create function ouranos.member_role(org uuid) returns text language sql stable security definer set search_path='' as $$ select role from public.memberships where organization_id=org and user_id=auth.uid() and active $$;
create function ouranos.can_view_trip(org uuid,trip uuid) returns boolean language sql stable security definer set search_path='' as $$
 select ouranos.member_role(org) is not null and exists(select 1 from public.trips t where t.organization_id=org and t.id=trip and (t.traveler_id=auth.uid() or ouranos.member_role(org) in ('admin','auditor') or exists(select 1 from public.approval_requests r join public.approval_steps s on s.request_id=r.id where r.organization_id=org and r.trip_id=trip and s.assignee_id=auth.uid())))
$$;
create function ouranos.can_edit_trip(org uuid,trip uuid) returns boolean language sql stable security definer set search_path='' as $$ select ouranos.member_role(org) is not null and exists(select 1 from public.trips where organization_id=org and id=trip and traveler_id=auth.uid()) $$;
revoke all on all functions in schema ouranos from public;
grant execute on function ouranos.member_role(uuid),ouranos.can_view_trip(uuid,uuid),ouranos.can_edit_trip(uuid,uuid) to authenticated,ouranos_api;

-- Bootstrap creates only the caller's own new tenant, and is deliberately not
-- exposed as a Supabase RPC to browser roles.
create function ouranos.create_organization(new_id uuid,org_name text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into public.organizations(id,name,created_by) values(new_id,org_name,auth.uid());
 insert into public.memberships(organization_id,user_id,role) values(new_id,auth.uid(),'admin');
 return new_id;
end $$;
revoke all on function ouranos.create_organization(uuid,text) from public;
grant execute on function ouranos.create_organization(uuid,text) to ouranos_api;

-- Select visibility; client Data API access is always read-only. Write policies
-- apply only to the non-login role used by the authenticated command API.
do $$ declare tbl text;begin
 foreach tbl in array array['organizations','memberships','devices','trips','authorizations','expenses','vouchers','documents','document_links','workflow_definitions','submission_revisions','approval_requests','approval_steps','approval_decisions','extraction_runs','notifications','integration_deliveries','processed_commands','change_log','audit_events','job_results','failed_jobs'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
 end loop;
end $$;
grant select on public.organizations,public.memberships,public.trips,public.authorizations,public.expenses,public.vouchers,public.documents,public.document_links,public.workflow_definitions,public.submission_revisions,public.approval_requests,public.approval_steps,public.approval_decisions,public.extraction_runs,public.notifications,public.integration_deliveries to authenticated;
grant select,insert,update on public.organizations,public.memberships,public.devices,public.trips,public.authorizations,public.expenses,public.vouchers,public.documents,public.document_links,public.workflow_definitions,public.approval_requests,public.approval_steps,public.notifications,public.integration_deliveries to ouranos_api;
grant select,insert on public.submission_revisions,public.approval_decisions,public.processed_commands,public.audit_events,public.change_log to ouranos_api;
grant select on public.extraction_runs to ouranos_api;
grant delete on public.document_links to ouranos_api;
grant usage,select on sequence public.change_log_cursor_seq,public.audit_events_id_seq to ouranos_api;

create policy org_read on public.organizations for select to authenticated,ouranos_api using(ouranos.member_role(id) is not null);
create policy membership_read on public.memberships for select to authenticated,ouranos_api using(user_id=auth.uid() or ouranos.member_role(organization_id)='admin');
create policy membership_write on public.memberships for all to ouranos_api using(ouranos.member_role(organization_id)='admin') with check(ouranos.member_role(organization_id)='admin');
create policy device_own on public.devices for all to ouranos_api using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null) with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy trip_read on public.trips for select to authenticated,ouranos_api using(ouranos.can_view_trip(organization_id,id));
create policy trip_insert on public.trips for insert to ouranos_api with check(traveler_id=auth.uid() and created_by=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy trip_update on public.trips for update to ouranos_api using(ouranos.can_edit_trip(organization_id,id)) with check(ouranos.can_edit_trip(organization_id,id));
do $$ declare tbl text;begin
 foreach tbl in array array['authorizations','expenses','vouchers','documents','submission_revisions','approval_requests','integration_deliveries'] loop
  execute format('create policy record_read on public.%I for select to authenticated,ouranos_api using(ouranos.can_view_trip(organization_id,trip_id))',tbl);
  execute format('create policy record_insert on public.%I for insert to ouranos_api with check(ouranos.can_edit_trip(organization_id,trip_id))',tbl);
 end loop;
 foreach tbl in array array['authorizations','expenses','vouchers','documents','approval_requests','integration_deliveries'] loop
  execute format('create policy record_update on public.%I for update to ouranos_api using(ouranos.can_view_trip(organization_id,trip_id)) with check(ouranos.can_view_trip(organization_id,trip_id))',tbl);
 end loop;
end $$;
create policy workflow_read on public.workflow_definitions for select to authenticated,ouranos_api using(ouranos.member_role(organization_id) is not null);
create policy workflow_write on public.workflow_definitions for all to ouranos_api using(ouranos.member_role(organization_id)='admin') with check(ouranos.member_role(organization_id)='admin');
create policy steps_read on public.approval_steps for select to authenticated,ouranos_api using(exists(select 1 from public.approval_requests where id=request_id));
create policy steps_write on public.approval_steps for all to ouranos_api using(exists(select 1 from public.approval_requests where id=request_id)) with check(exists(select 1 from public.approval_requests where id=request_id));
create policy decisions_read on public.approval_decisions for select to authenticated,ouranos_api using(exists(select 1 from public.approval_requests where id=request_id));
create policy decisions_insert on public.approval_decisions for insert to ouranos_api with check(actor_id=auth.uid() and exists(select 1 from public.approval_requests where id=request_id));
create policy links_read on public.document_links for select to authenticated,ouranos_api using(exists(select 1 from public.documents where id=document_id));
create policy links_write on public.document_links for all to ouranos_api using(exists(select 1 from public.documents where id=document_id and ouranos.can_edit_trip(organization_id,trip_id))) with check(exists(select 1 from public.documents where id=document_id and ouranos.can_edit_trip(organization_id,trip_id)));
create policy extraction_read on public.extraction_runs for select to authenticated,ouranos_api using(exists(select 1 from public.documents where id=document_id));
create policy notification_read on public.notifications for select to authenticated,ouranos_api using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy notification_insert on public.notifications for insert to ouranos_api with check(ouranos.can_view_trip(organization_id,trip_id));
create policy notification_update on public.notifications for update to ouranos_api using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null) with check(user_id=auth.uid());
create policy command_own on public.processed_commands for all to ouranos_api using(user_id=auth.uid() and ouranos.member_role(organization_id) is not null) with check(user_id=auth.uid() and ouranos.member_role(organization_id) is not null);
create policy changes_read on public.change_log for select to ouranos_api using(ouranos.member_role(organization_id) is not null and (trip_id is null or ouranos.can_view_trip(organization_id,trip_id)) and (kind<>'notification' or entity->'data'->>'recipientId'=auth.uid()::text));
create policy changes_insert on public.change_log for insert to ouranos_api with check(ouranos.member_role(organization_id) is not null);
create policy audit_read on public.audit_events for select to ouranos_api using(ouranos.member_role(organization_id) is not null and (trip_id is null or ouranos.can_view_trip(organization_id,trip_id)));
create policy audit_insert on public.audit_events for insert to ouranos_api with check(actor_id=auth.uid() and ouranos.member_role(organization_id) is not null);

-- Revision and decision rows are append-only even for accidental admin updates.
create function ouranos.prevent_history_change() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'History is append-only'; end $$;
create trigger immutable_revision before update or delete on public.submission_revisions for each row execute function ouranos.prevent_history_change();
create trigger immutable_decision before update or delete on public.approval_decisions for each row execute function ouranos.prevent_history_change();
create trigger immutable_audit before update or delete on public.audit_events for each row execute function ouranos.prevent_history_change();

select pgmq.create('ouranos_jobs');
create function ouranos.enqueue_job(message jsonb) returns bigint language sql security definer set search_path='' as $$ select pgmq.send('ouranos_jobs',message) $$;
revoke all on function ouranos.enqueue_job(jsonb) from public;
grant execute on function ouranos.enqueue_job(jsonb) to ouranos_api;

-- All files are private. Direct browser uploads/reads are not granted; the API
-- issues short-lived signed capabilities after checking document access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ouranos-documents','ouranos-documents',false,20971520,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
