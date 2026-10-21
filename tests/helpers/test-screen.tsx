import type { ReactNode } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Supplies measured safe-area bounds for host component interactions.
 * @param props Finite component test content.
 * @param props.children Component under interaction test.
 * @returns Material and safe-area test composition with native font registration supplied by the Jest boundary.
 */
export const TestScreen = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 360, height: 800 },
      insets: { top: 24, bottom: 24, left: 0, right: 0 },
    }}
  >
    <PaperProvider>{children}</PaperProvider>
  </SafeAreaProvider>
);
