-- Supabase's postgres login is not a true superuser. Explicitly permit the
-- trusted server connection to enter the constrained, non-login API role.
grant ouranos_api to postgres;
