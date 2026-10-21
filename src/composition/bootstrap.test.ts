import { createHostDatabase } from '../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { bootstrap } from './bootstrap';

it('APP-001 bootstraps first launch without creating an unconfirmed profile', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  const result = await bootstrap(async () => database);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.profile).toBeNull();
    expect(result.value.recoveryReady).toBe(false);
    await result.value.close();
  } else await database.close();
});

it('APP-001 translates startup failure without resetting data and closes its handle', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  await database.schema(async (sql) => {
    await sql.batch('PRAGMA user_version=99');
  });
  const close = jest.spyOn(database, 'close');
  const result = await bootstrap(async () => database);
  expect(result).toMatchObject({ ok: false, error: { code: 'unsupported-schema' } });
  expect(close).toHaveBeenCalledTimes(1);
});
