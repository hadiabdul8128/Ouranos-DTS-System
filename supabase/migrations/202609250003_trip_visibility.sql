-- RETURNING must evaluate ownership from the new row itself. A STABLE helper
-- querying trips cannot see a row inserted earlier in the same SQL statement.
drop policy trip_read on public.trips;
create policy trip_read on public.trips for select to authenticated,ouranos_api using(ouranos.member_role(organization_id) is not null and (traveler_id=auth.uid() or ouranos.can_view_trip(organization_id,id)));
