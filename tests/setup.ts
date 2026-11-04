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

// Host tests model the native confirmation/cancellation boundary; Android verifies the real calendar.
jest.mock('@expo/ui/jetpack-compose', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    /** Supplies a host container without native Material palette lookup.
     * @param props Compose content under test.
     * @param props.children Native child views rendered by the host test.
     * @returns Host-only children.
     */
    Host: ({ children }: { children: import('react').ReactNode }) =>
      createElement(View, null, children),
    /** Exposes native selection and dismissal callbacks to host interaction tests.
     * @param props Native dialog boundary callbacks and initial calendar value.
     * @returns Inspectable native picker stand-in.
     */
    DatePickerDialog: (props: import('@expo/ui/jetpack-compose').DatePickerDialogProps) =>
      createElement(View, { ...props, testID: 'native-date-picker' }),
  };
});
