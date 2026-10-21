// Native font registration has no asset registry in Jest. Android diagnostics verify real assets.
jest.mock('expo-font', () => ({
  /** Models fonts already registered by the native build plugin.
   * @returns Native availability for host-only component interactions.
   */
  isLoaded: () => true,
  /** Models an idle native font loader.
   * @returns No pending native load.
   */
  isLoading: () => false,
  /** Completes the unused host font-loading boundary. */
  loadAsync: async () => {},
}));

afterEach(() => {
  jest.restoreAllMocks();
});
