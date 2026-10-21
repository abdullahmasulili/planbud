import type { SqlExecutor } from './connection';

/** Raw replay outcome; each owning repository validates its cached result contract. */
export type CommandReplay =
  { readonly found: false } | { readonly found: true; readonly value: unknown };

/** Encodes canonical plain command data without accepting undefined results.
 * @param value Validated domain input or explicit portable result.
 * @returns JSON text suitable for a bound SQL parameter.
 * @throws When a programming error supplies a non-serializable command value.
 */
const encodeJson = (value: unknown): string => {
  const encoded = JSON.stringify(value);
  if (typeof encoded !== 'string') throw new Error('Invalid command value.');
  return encoded;
};

/** Finds an atomic command replay and rejects reuse with different canonical input.
 * @param sql Transaction-scoped database capability.
 * @param operationId Stable user-action identity.
 * @param action Owning domain and operation namespace.
 * @param input Canonical input in authoritative property order.
 * @returns Validated replay identity with an untrusted cached result, or absence.
 */
export const readCommand = async (
  sql: SqlExecutor,
  operationId: string,
  action: string,
  input: unknown,
): Promise<CommandReplay> => {
  const row = await sql.first(
    'SELECT action,input_json,result_json FROM commands WHERE operation_id=?',
    [operationId],
  );
  if (!row) return { found: false };
  if (row.action !== action || row.input_json !== encodeJson(input))
    throw Object.assign(new Error('Command input conflicts with an earlier action.'), {
      code: 'command-conflict',
    });
  if (typeof row.result_json !== 'string') throw new Error('Invalid cached command result.');
  const value: unknown = JSON.parse(row.result_json);
  return { found: true, value };
};

/** Persists replay metadata in the same transaction as its owning record mutation.
 * @param sql Transaction-scoped database capability.
 * @param operationId Stable action identity.
 * @param action Owning domain and operation namespace.
 * @param input Canonical validated command input.
 * @param result Portable result; use null for a completed void operation.
 * @returns Completion; rejects conflicts or invalid serialized values atomically.
 */
export const recordCommand = async (
  sql: SqlExecutor,
  operationId: string,
  action: string,
  input: unknown,
  result: unknown,
): Promise<void> => {
  await sql.execute(
    'INSERT INTO commands(operation_id,action,input_json,result_json) VALUES (?,?,?,?)',
    [operationId, action, encodeJson(input), encodeJson(result)],
  );
};
