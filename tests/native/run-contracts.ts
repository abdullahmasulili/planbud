import { deleteDatabaseAsync } from 'expo-sqlite';
import { getLoadedFonts } from 'expo-font';
import { openDatabase } from '@/shared/infrastructure/database/connection';
import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import type { ContractReport } from './contract-report';
import { runDatabaseContract } from './database-contract';
import { runRecoveryContract } from './recovery-contract';
import { runCryptoContract } from './crypto-contract';
import { runRestoreContract } from './restore-contract';

/** Runs development diagnostics in disposable namespaces without touching user data.
 * @returns Sanitized native results including connection cleanup and reopen behavior.
 */
export const runNativeContracts = async (): Promise<ContractReport> => {
  const name = `plan-bud-contract-${Date.now()}.db`;
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  let database: DatabaseHandle | undefined;
  try {
    if (getLoadedFonts().includes('Plus Jakarta Sans')) passed.push('bundled-font-registered');
    else failed.push({ name: 'bundled-font-registered', code: 'font-not-registered' });
    database = await openDatabase(name);
    const report = await runDatabaseContract(database);
    passed.push(...report.passed);
    failed.push(...report.failed);
    const revision = await database.revision();
    await database.close();
    database = await openDatabase(name);
    if ((await database.revision()) === revision) passed.push('native-reopen');
    else failed.push({ name: 'native-reopen', code: 'revision-not-retained' });
    const recovery = await runRecoveryContract();
    passed.push(...recovery.passed);
    failed.push(...recovery.failed);
    const crypto = await runCryptoContract();
    passed.push(...crypto.passed);
    failed.push(...crypto.failed);
    const restore = await runRestoreContract();
    passed.push(...restore.passed);
    failed.push(...restore.failed);
  } catch {
    failed.push({ name: 'native-database-lifecycle', code: 'native-operation-failed' });
  } finally {
    if (database) {
      try {
        await database.close();
      } catch {
        failed.push({ name: 'native-close', code: 'cleanup-failed' });
      }
    }
    try {
      await deleteDatabaseAsync(name);
    } catch {
      failed.push({ name: 'native-delete-isolated-database', code: 'cleanup-failed' });
    }
  }
  return { passed, failed };
};
