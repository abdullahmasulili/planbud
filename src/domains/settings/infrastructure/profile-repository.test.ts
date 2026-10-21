import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from './profile-repository';
import type { Profile } from '../domain/profile';

const profile: Profile = {
  id: 'personal',
  currency: { code: 'IDR', exponent: 2 },
  locale: 'id-ID',
  appearance: 'system',
};

describe('local profile persistence', () => {
  it('SET-001 initializes one profile idempotently and refuses currency relabeling', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      const repository = createProfileRepository(database);
      expect(await repository.read()).toBeNull();
      expect(await repository.initialize(profile)).toEqual(profile);
      expect(await repository.initialize(profile)).toEqual(profile);
      expect(await database.revision()).toBe(1);
      await expect(
        repository.initialize({ ...profile, currency: { code: 'USD', exponent: 2 } }),
      ).rejects.toMatchObject({ code: 'profile-exists' });
      await expect(repository.initialize({ ...profile, id: 'second' })).rejects.toMatchObject({
        code: 'profile-exists',
      });
      await repository.setAppearance('dark');
      await repository.setAppearance('dark');
      expect(await database.revision()).toBe(2);
    } finally {
      await database.close();
    }
  });

  it('SET-002 retains confirmed currency and appearance after reopening', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'plan-bud-profile-'));
    const filename = join(folder, 'contract.db');
    const first = createDatabaseHandle(createHostDatabase(filename));
    try {
      await migrateDatabase(first);
      const repository = createProfileRepository(first);
      await repository.initialize(profile);
      await repository.setAppearance('light');
    } finally {
      await first.close();
    }
    const reopened = createDatabaseHandle(createHostDatabase(filename));
    try {
      await migrateDatabase(reopened);
      expect(await createProfileRepository(reopened).read()).toEqual({
        ...profile,
        appearance: 'light',
      });
      expect(await reopened.revision()).toBe(2);
    } finally {
      await reopened.close();
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('SET-001 rejects unconfirmed currency metadata before writing', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      await expect(
        createProfileRepository(database).initialize({
          ...profile,
          currency: { code: 'IDR', exponent: 0 },
        }),
      ).rejects.toMatchObject({ code: 'invalid-profile' });
      expect(await database.revision()).toBe(0);
    } finally {
      await database.close();
    }
  });
});
