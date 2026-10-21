/** Identifies the real SQLite full-database fault, including an automatic-rollback cleanup error.
 * @param error Native or host error captured only by a disposable storage contract.
 * @returns Whether SQLite actually reported its full-storage condition.
 */
export const isStorageFull = (error: unknown): boolean => {
  if (error instanceof AggregateError) {
    const causes: readonly unknown[] = error.errors;
    return causes.some(isStorageFull);
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    /database or disk is full|SQLITE_FULL/i.test(error.message)
  );
};
