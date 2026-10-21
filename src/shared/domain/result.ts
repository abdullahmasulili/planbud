/** Sanitized application outcome, distinct from an unexpected programming exception. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Stable operation identity and canonical input retained across retries of one user action. */
export type Command<T> = { readonly operationId: string; readonly input: T };
