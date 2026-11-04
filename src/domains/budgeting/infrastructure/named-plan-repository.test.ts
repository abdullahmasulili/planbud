import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createNamedPlanRepository } from './named-plan-repository';
import { createNamedPlanService } from '../application/named-plan-service';
import { createSnapshotRepository } from '@/domains/backup/infrastructure/snapshot-repository';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';

it('PLAN-001/003 persists independent estimates, rejects stale mutations, and round-trips backups', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'p',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createNamedPlanService(createNamedPlanRepository(database));
    const vacation = {
      id: 'vacation',
      name: 'Vacation',
      funding: 100000,
      items: [{ id: 'hotel', name: 'Hotel', amount: 60000 }],
    };
    let revision = await database.revision();
    expect(await service.save({ plan: vacation, expectedRevision: revision })).toMatchObject({
      ok: true,
    });
    expect(
      await service.save({ plan: { ...vacation, name: 'Changed' }, expectedRevision: revision }),
    ).toMatchObject({ ok: false, error: { code: 'stale-data' } });
    revision = await database.revision();
    expect(
      await service.save({
        plan: { ...vacation, id: 'wedding', name: 'Wedding', items: [] },
        expectedRevision: revision,
      }),
    ).toMatchObject({ ok: true });
    expect(await service.read()).toMatchObject({
      ok: true,
      value: { plans: [vacation, { id: 'wedding', name: 'Wedding' }] },
    });
    expect(await service.remove({ id: 'vacation', expectedRevision: revision })).toMatchObject({
      ok: false,
      error: { code: 'stale-data' },
    });
    const exported = await createSnapshotRepository(
      database,
      () => '2026-10-27T00:00:00.000Z',
    ).readConsistent();
    expect(exported.snapshot).toMatchObject({
      schemaVersion: 2,
      namedPlans: [vacation, { id: 'wedding' }],
      plans: [],
      transactions: [],
    });
    const restore = createRestoreRepository(database);
    await restore.replace({
      snapshot: exported.snapshot,
      expectedRevision: await database.revision(),
      recovery: { profileId: 'p', generation: 'g', fingerprint: 'a'.repeat(64), status: 'pending' },
    });
    expect(await createNamedPlanService(createNamedPlanRepository(database)).read()).toMatchObject({
      ok: true,
      value: { plans: [vacation, { id: 'wedding' }] },
    });
    expect(
      await service.remove({ id: 'vacation', expectedRevision: await database.revision() }),
    ).toMatchObject({ ok: true });
    expect(await service.read()).toMatchObject({ ok: true, value: { plans: [{ id: 'wedding' }] } });
    await restore.reset(await database.revision());
    expect(await service.read()).toMatchObject({ ok: true, value: { plans: [] } });
  } finally {
    await database.close();
  }
});

it('PLAN-003 imports a legacy backup by clearing named plans without changing the legacy source data', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'p',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createNamedPlanService(createNamedPlanRepository(database));
    await service.save({
      plan: { id: 'old', name: 'Old plan', funding: 0, items: [] },
      expectedRevision: await database.revision(),
    });
    const exported = await createSnapshotRepository(
      database,
      () => '2026-10-27T00:00:00.000Z',
    ).readConsistent();
    const source = exported.snapshot;
    if (source.schemaVersion !== 2) throw new Error('Expected a current snapshot.');
    const { namedPlans, ...base } = source;
    expect(namedPlans).toHaveLength(1);
    const legacy = { ...base, schemaVersion: 1 as const };
    await createRestoreRepository(database).replace({
      snapshot: legacy,
      expectedRevision: await database.revision(),
      recovery: {
        profileId: 'p',
        generation: 'legacy',
        fingerprint: 'a'.repeat(64),
        status: 'pending',
      },
    });
    expect(await service.read()).toMatchObject({ ok: true, value: { plans: [] } });
    const read = await createSnapshotRepository(database, () => legacy.createdAt).readConsistent();
    expect(read.snapshot).toEqual({ ...legacy, schemaVersion: 2, namedPlans: [] });
  } finally {
    await database.close();
  }
});
