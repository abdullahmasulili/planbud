import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import type { ContractReport } from './contract-report';

/** Exercises real SQLite transactions in a disposable database supplied by diagnostics.
 * @param database Isolated database; never pass the user's financial database.
 * @returns Portable evidence without SQL errors, records, or device paths.
 */
export const runDatabaseContract = async (database: DatabaseHandle): Promise<ContractReport> => {
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  /** Records a native assertion while preserving independence of later cases.
   * @param name Stable acceptance case name.
   * @param check Native behavior to assert.
   * @returns Completion after recording one sanitized result.
   */
  const run = async (name: string, check: () => Promise<boolean>) => {
    try {
      if (await check()) passed.push(name);
      else failed.push({ name, code: 'assertion-failed' });
    } catch {
      failed.push({ name, code: 'native-operation-failed' });
    }
  };
  await migrateDatabase(database);
  await run('migration-idempotent', async () => {
    const before = await database.revision();
    await migrateDatabase(database);
    return (await database.revision()) === before;
  });
  await run('foreign-keys-enabled', async () => {
    const row = await database.read(async (sql) => await sql.first('PRAGMA foreign_keys'));
    return row?.foreign_keys === 1;
  });
  await run('rollback-and-revision', async () => {
    const before = await database.revision();
    let rejected = false;
    try {
      await database.write(async (sql) => {
        await sql.execute(
          "INSERT INTO categories(id,name,kind) VALUES ('contract-rollback','Rollback','essential')",
        );
        throw new Error('Deliberate contract rollback.');
      });
    } catch {
      rejected = true;
    }
    const row = await database.read(
      async (sql) => await sql.first("SELECT id FROM categories WHERE id='contract-rollback'"),
    );
    return rejected && row === null && (await database.revision()) === before;
  });
  await run('concurrent-commits', async () => {
    const before = await database.revision();
    await Promise.all(
      ['contract-a', 'contract-b'].map(
        async (id) =>
          await database.write(async (sql) => {
            await Promise.resolve();
            await sql.execute('INSERT INTO categories(id,name,kind) VALUES (?,?,?)', [
              id,
              id,
              'essential',
            ]);
            return { value: undefined, changed: true };
          }),
      ),
    );
    return (await database.revision()) === before + 2;
  });
  await run('schema-rollback', async () => {
    let rejected = false;
    try {
      await database.schema(async (sql) => {
        await sql.batch('CREATE TABLE contract_rollback (value TEXT)');
        throw new Error('Deliberate migration rollback.');
      });
    } catch {
      rejected = true;
    }
    const row = await database.read(
      async (sql) =>
        await sql.first("SELECT name FROM sqlite_master WHERE name='contract_rollback'"),
    );
    return rejected && row === null;
  });
  return { passed, failed };
};
