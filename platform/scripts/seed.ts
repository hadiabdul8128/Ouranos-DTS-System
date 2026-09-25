import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readConfig } from '../shared/config';
import { makePool, withActor } from '../shared/database';
import { executeCommand } from '../api/commands';
import type { Command } from '../../packages/contracts';

// This fixture script must never write to a hosted project, even when one
// endpoint is accidentally copied from a production environment file.
const config = readConfig();
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
if (config.NODE_ENV === 'production' ||
    !loopback.has(new URL(config.SUPABASE_URL).hostname) ||
    !loopback.has(new URL(config.DATABASE_URL).hostname)) {
  throw new Error('Fixture seeding requires local Auth and database endpoints');
}

const pool = makePool(config);
const auth = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const organizationId = 'c9fde92d-0b55-4ad0-a579-22a2f2cf0001';
const tripId = 'c9fde92d-0b55-4ad0-a579-22a2f2cf0002';
const fixtureRoles = ['admin', 'traveler', 'reviewer', 'approver'] as const;
const users: Record<string, string> = {};

async function run(userId: string, command: Command) {
  const result = await executeCommand(pool, auth, userId, command, true);
  if (!result.ok) throw new Error(`Fixture command failed: ${result.error.code}`);
}

try {
  for (const role of fixtureRoles) {
    const email = `${role}@ouranos.test`;
    const existing = await pool.query<{ id: string }>(
      'select id from auth.users where lower(email) = $1', [email],
    );
    if (existing.rows[0]) users[role] = existing.rows[0].id;
    else {
      const { data, error } = await auth.auth.admin.createUser({
        email, password: randomUUID() + randomUUID(), email_confirm: true,
      });
      if (error || !data.user) throw new Error(`Cannot create local ${role} fixture`);
      users[role] = data.user.id;
    }
  }

  if (!(await pool.query('select id from ouranos.organizations where id=$1', [organizationId])).rowCount) {
    await withActor(pool, users.admin, undefined, async db => {
      await db.query('select ouranos.create_organization($1,$2)', [organizationId, 'Ouranos local workspace']);
    });
  }
  // Reruns preserve existing memberships, drafts, and administrator choices.
  for (const role of fixtureRoles) {
    await pool.query(
      'insert into ouranos.memberships(organization_id,user_id,role,active) values($1,$2,$3,true) on conflict(organization_id,user_id) do nothing',
      [organizationId, users[role], role],
    );
  }

  const deviceId = randomUUID();
  for (const kind of ['authorization', 'voucher'] as const) {
    const exists = await pool.query('select id from ouranos.workflow_definitions where organization_id=$1 and kind=$2', [organizationId, kind]);
    if (!exists.rowCount) await run(users.admin, {
      commandId: randomUUID(), organizationId, deviceId, schemaVersion: 1,
      entityId: randomUUID(), expectedVersion: 0, type: 'workflow.configure',
      payload: { kind, name: 'Local review and approval', steps: [
        { assigneeId: users.reviewer, role: 'reviewer' },
        { assigneeId: users.approver, role: 'approver' },
      ] },
    });
  }

  if (!(await pool.query('select id from ouranos.trips where id=$1', [tripId])).rowCount) {
    await run(users.traveler, {
      commandId: randomUUID(), organizationId, deviceId: randomUUID(), schemaVersion: 1,
      entityId: tripId, expectedVersion: 0, type: 'trip.save',
      payload: {
        destination: 'Washington, DC', departure: '2026-10-12', returnDate: '2026-10-15',
        purpose: 'Synthetic local development trip', timezone: 'America/New_York',
      },
    });
  }
  console.log('Local workspace ready. Sign in by email at http://localhost:5173:');
  for (const role of fixtureRoles) console.log(`  ${role}@ouranos.test`);
  console.log('Open the sign-in email in the local inbox at http://127.0.0.1:56324.');
  console.log('Fixtures are synthetic. No external travel request was submitted.');
} finally {
  await pool.end();
}
