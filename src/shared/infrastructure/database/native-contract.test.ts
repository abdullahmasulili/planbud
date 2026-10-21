import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { runDatabaseContract } from '../../../../tests/native/database-contract';
import { createDatabaseHandle } from './connection';

it('DATA-001 runs the portable contract against real host SQLite', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    const report = await runDatabaseContract(database);
    expect(report.failed).toEqual([]);
    expect(report.passed).toHaveLength(5);
  } finally {
    await database.close();
  }
});
