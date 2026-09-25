// Export an atomic migration batch with an Ouranos-only ledger. A shared
// project's supabase_migrations history belongs to its existing application.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const destination=process.argv[2];
if(!destination)throw new Error('Provide an output SQL path, then review and apply it with supabase db query --linked --file PATH');
const literal=value=>`'${value.replaceAll("'","''")}'`;
const statements=[
 'begin;',
 "select pg_advisory_xact_lock(hashtextextended('ouranos:migrations',0));",
 'create schema if not exists ouranos;',
 'create table if not exists ouranos.schema_migrations(version text primary key, sha256 text not null, applied_at timestamptz not null default now());',
 'alter table ouranos.schema_migrations enable row level security;',
 'revoke all on ouranos.schema_migrations from public,anon,authenticated;'
];
for(const filename of readdirSync('supabase/migrations').filter(name=>/^\d+_.+\.sql$/.test(name)).sort()){
 const sql=readFileSync(`supabase/migrations/${filename}`,'utf8');
 const version=filename.split('_')[0];
 const digest=createHash('sha256').update(sql).digest('hex');
 statements.push(`do $ouranos_migration$
 begin
  if exists(select 1 from ouranos.schema_migrations where version=${literal(version)} and sha256<>${literal(digest)}) then
   raise exception 'Previously applied Ouranos migration changed: ${version}';
  end if;
  if not exists(select 1 from ouranos.schema_migrations where version=${literal(version)}) then
   execute ${literal(sql)};
   insert into ouranos.schema_migrations(version,sha256) values(${literal(version)},${literal(digest)});
  end if;
 end $ouranos_migration$;`);
}
statements.push('commit;','select version,sha256 from ouranos.schema_migrations order by version;');
writeFileSync(resolve(destination),`${statements.join('\n\n')}\n`,{mode:0o600});
console.log('Wrote atomic Ouranos migrations. Existing application migration history is preserved.');
