/** Starts a terminally observed operation for native callbacks that cannot await.
 * @param work Operation checking active state before view updates.
 * @param onFailure Sanitized UI failure handler.
 * @returns A cancellation function that prevents stale presentation updates.
 */
export const launchOperation = (
  work: (isActive: () => boolean) => Promise<void>,
  onFailure: (error: unknown) => void,
): (() => void) => {
  let active = true;
  const isActive = () => active;
  Promise.resolve()
    .then(async () => {
      if (!active) return;
      await work(isActive);
    })
    .catch((error: unknown) => {
      if (!active) return;
      try {
        onFailure(error);
      } catch {
        console.error('Unable to present operation failure.');
      }
    });
  return () => {
    active = false;
  };
};
