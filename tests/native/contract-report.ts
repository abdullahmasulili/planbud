/** Portable native evidence containing case names and sanitized failure codes only. */
export type ContractReport = {
  readonly passed: readonly string[];
  readonly failed: readonly { readonly name: string; readonly code: string }[];
};
