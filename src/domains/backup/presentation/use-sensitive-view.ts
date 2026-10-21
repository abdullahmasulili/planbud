import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { launchOperation } from '@/shared/presentation/operation-launcher';

/** Protects a focused secret view before exposure and disposes its local session on blur/background.
 * @param protection Native capture/recents protection leases.
 * @param dispose Stable callback dropping all local phrase/plaintext references.
 * @returns Protection readiness and sanitized acquisition failure.
 */
export const useSensitiveView = (protection: SensitiveScreenPort, dispose: () => void) => {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => () => dispose(), [dispose]));
  useEffect(() => {
    let live = true;
    let lease: string | undefined;
    const cancel = launchOperation(
      async (isActive) => {
        const key = await protection.acquire();
        if (!live || !isActive()) {
          await protection.release(key);
          return;
        }
        lease = key;
        setReady(true);
      },
      () => {
        if (live) setMessage('Unable to protect this screen. Close it and try again.');
      },
    );
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') dispose();
    });
    const blur = AppState.addEventListener('blur', dispose);
    return () => {
      live = false;
      cancel();
      subscription.remove();
      blur.remove();
      dispose();
      setReady(false);
      if (lease) {
        const key = lease;
        launchOperation(
          async () => await protection.release(key),
          () =>
            console.error(
              'Unable to release screen protection. Restart the app to reset capture protection.',
            ),
        );
      }
    };
  }, [dispose, protection]);
  return { ready, message };
};
