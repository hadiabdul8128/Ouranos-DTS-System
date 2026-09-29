import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OuranosDatabase} from '../../packages/offline/database';
import {LocalRepository} from '../../packages/offline/repository';
import {SyncEngine, type SyncState} from '../../packages/offline/sync';
import type {OuranosClient} from '../../packages/sdk';
import type {Command, Entity} from '../../packages/contracts';

const databases: OuranosDatabase[] = [];
afterEach(async () => {vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const db of databases) await db.delete(); databases.length = 0});
function setup() {
  const db = new OuranosDatabase(crypto.randomUUID()); databases.push(db);
  const repo = new LocalRepository(db, crypto.randomUUID());
  const states: SyncState[] = [];
  const entities: Entity[] = [];
  const client = {
    push: vi.fn(async (commands: Command[]) => ({results: commands.map(command => {
      const entity: Entity = {id: command.entityId, organizationId: repo.organizationId, kind: command.type.split('.')[0] as Entity['kind'], version: 1, status: 'draft', data: command.payload, updatedAt: new Date().toISOString()};
      entities.push(entity); return {commandId: command.commandId, ok: true, entity};
    })})),
    bootstrap: vi.fn(async () => ({entities, cursor: '1'})),
  };
  const engine = new SyncEngine(db, client as unknown as OuranosClient, repo.organizationId, state => states.push(state));
  return {db, repo, states, client, engine};
}
const trip = {destination: 'Boston', departure: '2026-10-12', returnDate: '2026-10-15', purpose: 'Test', timezone: 'UTC'};

describe('interrupted local storage during receipt synchronization', () => {
  it('handles a second database failure inside recovery without losing the known pending count', async () => {
    const {db, repo, states, client, engine} = setup();
    await repo.stage('trip.save', crypto.randomUUID(), trip);
    const envelope = (await db.outbox.toArray())[0];
    const count = vi.spyOn(db.outbox, 'count');
    count.mockResolvedValueOnce(1).mockRejectedValueOnce(new Dexie.AbortError('Interrupted'));
    vi.spyOn(db.outbox, 'orderBy').mockImplementationOnce(() => {throw new Dexie.AbortError('Interrupted')});
    await expect(engine.sync()).resolves.toBeUndefined();
    expect(states.at(-1)).toMatchObject({state: 'blocked', pending: 1});
    expect(states.at(-1)?.message).toContain('Local storage was interrupted');
    expect(client.push).not.toHaveBeenCalled();
    expect((await db.outbox.toArray())[0].commandId).toBe(envelope.commandId);
    await engine.sync();
    expect(client.push.mock.calls[0][0][0].commandId).toBe(envelope.commandId);
    expect(await db.outbox.count()).toBe(0);
  });
  it('rolls back an aborted acknowledgment and replays the original command', async () => {
    const {db, repo, engine, states, client} = setup();
    await repo.stage('trip.save', crypto.randomUUID(), trip);
    const original = (await db.outbox.toArray())[0].command;
    vi.spyOn(db.entities, 'put').mockRejectedValueOnce(new Dexie.AbortError('Transaction interrupted'));
    await engine.sync();
    expect((await db.outbox.toArray())[0].command).toEqual(original);
    expect(states.at(-1)?.state).toBe('blocked');
    await engine.sync();
    expect(client.push.mock.calls[1][0][0]).toEqual(original);
    expect(await db.outbox.count()).toBe(0);
  });
  it('retains receipt bytes and registration when even the initial read is interrupted', async () => {
    const {db, repo, engine, states} = setup();
    const id = await repo.captureReceipt(crypto.randomUUID(), new File(['receipt'], 'camera.jpg', {type: 'image/jpeg'}));
    const command = (await db.outbox.toArray())[0].command;
    vi.spyOn(db.outbox, 'count').mockRejectedValueOnce(new Dexie.AbortError('Interrupted'));
    await expect(engine.sync()).resolves.toBeUndefined();
    expect(states.at(-1)).toMatchObject({state: 'blocked', pending: 2});
    expect((await db.outbox.toArray())[0].command).toEqual(command);
    const saved = await db.files.get(id);
    expect(saved?.state).toBe('pending');
    expect(saved?.blob.size).toBe(7);
    expect((await db.entities.get(`document:${id}`))?.local.data.filename).toBe('camera.jpg');
  });
  it('handles browser lock rejection and still permits a subsequent sync', async () => {
    const {engine, states, client} = setup();
    const request = vi.fn().mockRejectedValueOnce(new DOMException('Interrupted', 'AbortError')).mockImplementationOnce((_name: string, run: () => Promise<void>) => run());
    vi.stubGlobal('navigator', {locks: {request}});
    await expect(engine.sync()).resolves.toBeUndefined();
    expect(states.at(-1)?.state).toBe('blocked');
    expect(client.bootstrap).not.toHaveBeenCalled();
    await engine.sync();
    expect(client.bootstrap).toHaveBeenCalledTimes(1);
  });
});
