import { launchOperation } from './operation-launcher';

it('ASYNC-007 does not start work canceled before the callback boundary runs', async () => {
  const work = jest.fn(async () => undefined);
  const cancel = launchOperation(work, () => undefined);
  cancel();
  await Promise.resolve();
  expect(work).not.toHaveBeenCalled();
});

/** Flushes the terminal observer without depending on native timer behavior.
 * @returns Completion after queued promise observations.
 */
const settle = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

describe('native async operation boundary', () => {
  it('ASYNC-007 reports a rejected operation once', async () => {
    const failures: unknown[] = [];
    launchOperation(
      async () => {
        throw new Error('failure');
      },
      (error) => {
        failures.push(error);
      },
    );
    await settle();
    expect(failures).toHaveLength(1);
  });
  it('ASYNC-007 prevents canceled operations from updating views', async () => {
    const values: string[] = [];
    const cancel = launchOperation(
      async (isActive) => {
        await Promise.resolve();
        if (isActive()) values.push('stale');
      },
      () => {},
    );
    cancel();
    await settle();
    expect(values).toEqual([]);
  });
  it('ASYNC-004 observes a failing failure sink without leaking error details', async () => {
    const output = jest.spyOn(console, 'error').mockImplementation(() => {});
    launchOperation(
      async () => {
        throw new Error('private');
      },
      () => {
        throw new Error('also-private');
      },
    );
    await settle();
    expect(output).toHaveBeenCalledWith('Unable to present operation failure.');
  });
});
