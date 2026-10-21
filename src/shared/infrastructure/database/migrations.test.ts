import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from './connection';
import { migrateDatabase } from './migrations';

describe('SQLite migration and revision contracts', () => {
  it('DATA-001 advances only committed, changed writes', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      await database.write(async (sql) => {
        await sql.execute(
          "INSERT INTO categories(id,name,kind) VALUES ('food','Food','essential')",
        );
        return { value: 'food', changed: true };
      });
      expect(await database.revision()).toBe(1);
      await database.write(async () => ({ value: 'unchanged', changed: false }));
      expect(await database.revision()).toBe(1);
      await expect(
        database.write(async (sql) => {
          await sql.execute(
            "INSERT INTO categories(id,name,kind) VALUES ('travel','Travel','flexible')",
          );
          throw new Error('simulated failure');
        }),
      ).rejects.toThrow('simulated failure');
      expect(await database.revision()).toBe(1);
      expect(
        await database.read(
          async (sql) => await sql.first("SELECT id FROM categories WHERE id='travel'"),
        ),
      ).toBeNull();
    } finally {
      await database.close();
    }
  });

  it('DATA-001 serializes concurrent transactions without joining another write', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      await Promise.all(
        ['food', 'travel'].map(
          async (id) =>
            await database.write(async (sql) => {
              await Promise.resolve();
              await sql.execute('INSERT INTO categories(id,name,kind) VALUES (?,?,?)', [
                id,
                id,
                'flexible',
              ]);
              return { value: id, changed: true };
            }),
        ),
      );
      expect(await database.revision()).toBe(2);
    } finally {
      await database.close();
    }
  });

  it('DATA-001 preserves data when a future schema is encountered', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      await database.schema(async (sql) => {
        await sql.execute(
          "INSERT INTO categories(id,name,kind) VALUES ('food','Food','essential')",
        );
        await sql.batch('PRAGMA user_version = 2');
      });
      await expect(migrateDatabase(database)).rejects.toMatchObject({ code: 'unsupported-schema' });
      expect(
        await database.read(
          async (sql) => await sql.first("SELECT id FROM categories WHERE id='food'"),
        ),
      ).toEqual({ id: 'food' });
    } finally {
      await database.close();
    }
  });
  it('DATA-001 creates a versioned schema without inventing a financial mutation', async () => {
    const database = createDatabaseHandle(createHostDatabase());
    try {
      await migrateDatabase(database);
      const table = await database.read(
        async (sql) =>
          await sql.first("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'"),
      );
      expect(table?.name).toBe('profiles');
      expect(await database.revision()).toBe(0);
      await migrateDatabase(database);
      expect(await database.revision()).toBe(0);
    } finally {
      await database.close();
    }
  });
});
