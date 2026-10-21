import { useEffect, useRef, useState } from 'react';
import type { Result } from '../domain/result';
import { launchOperation } from './operation-launcher';

/** Owns native callback rejection observation, duplicate-tap locking, and teardown.
 * @returns Busy/error state and a synchronous event launcher for typed operations.
 */
export const useOperation = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const cancel = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      cancel.current?.();
    },
    [],
  );
  /** Starts one observed operation and ignores UI completion after unmount.
   * @param work Application operation returning a sanitized outcome.
   * @param commit Updates presentation only after a successful durable operation.
   */
  const run = <T>(work: () => Promise<Result<T>>, commit: (value: T) => void) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    cancel.current = launchOperation(
      async (isActive) => {
        const result = await work();
        if (!isActive()) return;
        locked.current = false;
        setBusy(false);
        if (result.ok) commit(result.value);
        else setMessage(result.error.message);
      },
      () => {
        locked.current = false;
        setBusy(false);
        setMessage('Unable to complete this action. Try again.');
      },
    );
  };
  /** Clears a resolved form error after explicit discard or corrected input. */
  const clearMessage = () => {
    setMessage('');
  };
  return { busy, message, run, clearMessage };
};
