import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { createGoalService } from '../application/goal-service';
import { createGoalRepository } from './goal-repository';
import type { Goal } from '../domain/goal';

it('MONEY-001 rejects monthly contribution overflow across different goals, including date corrections', async () => {
  const fixture = await createTransactionFixture();
  try {
    const service = createGoalService(createGoalRepository(fixture.database), () => '2026-10-20');
    for (const id of ['a', 'b'])
      await service.saveGoal({
        operationId: id,
        input: {
          id,
          name: id,
          target: Number.MAX_SAFE_INTEGER,
          startingSaved: 0,
          deadline: null,
          desiredMonthly: null,
          priority: 'high',
          state: 'active',
        },
      });
    const large = { id: 'large', goalId: 'a', amount: Number.MAX_SAFE_INTEGER, date: '2026-10-20' };
    const one = { id: 'one', goalId: 'b', amount: 1, date: '2026-11-01' };
    expect(await service.saveContribution({ operationId: 'large', input: large })).toMatchObject({
      ok: true,
    });
    expect(await service.saveContribution({ operationId: 'one', input: one })).toMatchObject({
      ok: true,
    });
    const before = await fixture.database.revision();
    expect(
      await service.saveContribution({ operationId: 'move', input: { ...one, date: large.date } }),
    ).toMatchObject({ ok: false, error: { code: 'amount-overflow' } });
    expect(await fixture.database.revision()).toBe(before);
    expect(await service.readGoals()).toMatchObject({
      ok: true,
      value: [
        { saved: Number.MAX_SAFE_INTEGER },
        { saved: 1, contributions: [{ date: '2026-11-01' }] },
      ],
    });
  } finally {
    await fixture.database.close();
  }
});

it('GOAL-001 preserves actual history through corrections, archival and completion; retries commit once', async () => {
  const fixture = await createTransactionFixture();
  try {
    const service = createGoalService(createGoalRepository(fixture.database), () => '2026-10-20');
    const goal: Goal = {
      id: 'goal',
      name: 'Emergency',
      target: 10000,
      startingSaved: 1000,
      deadline: '2026-09-30',
      priority: 'high',
      desiredMonthly: null,
      state: 'active',
    };
    expect(await service.saveGoal({ operationId: 'create-goal', input: goal })).toMatchObject({
      ok: true,
    });
    const contribution = { id: 'contribution', goalId: goal.id, amount: 2500, date: '2026-10-20' };
    const before = await fixture.database.revision();
    const results = await Promise.all([
      service.saveContribution({ operationId: 'add', input: contribution }),
      service.saveContribution({ operationId: 'add', input: contribution }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(await fixture.database.revision()).toBe(before + 1);
    expect(
      await service.saveContribution({
        operationId: 'add',
        input: { ...contribution, amount: 5000 },
      }),
    ).toMatchObject({ ok: false, error: { code: 'command-conflict' } });
    expect(
      await service.saveContribution({
        operationId: 'correct',
        input: { ...contribution, amount: 5000, date: '2026-11-01' },
      }),
    ).toMatchObject({ ok: true });
    expect(await service.readGoals()).toMatchObject({
      ok: true,
      value: [
        {
          saved: 6000,
          remaining: 4000,
          overdue: true,
          contributions: [{ amount: 5000, date: '2026-11-01' }],
        },
      ],
    });
    for (const state of ['completed', 'archived', 'active']) {
      if (state !== 'completed' && state !== 'archived' && state !== 'active')
        throw new Error('Invalid test state');
      expect(
        await service.saveGoal({ operationId: state, input: { ...goal, state } }),
      ).toMatchObject({ ok: true });
      expect(await service.readGoals()).toMatchObject({
        ok: true,
        value: [{ saved: 6000, contributions: [{ id: 'contribution' }] }],
      });
    }
    expect(await fixture.transactions.summary('2026-11')).toMatchObject({
      ok: true,
      value: { spending: 0, income: 0 },
    });
    expect(
      await service.removeContribution({ operationId: 'remove', input: { id: contribution.id } }),
    ).toMatchObject({ ok: true });
    const removed = await fixture.database.revision();
    expect(
      await service.removeContribution({ operationId: 'remove', input: { id: contribution.id } }),
    ).toMatchObject({ ok: true });
    expect(await fixture.database.revision()).toBe(removed);
    expect(await service.readGoals()).toMatchObject({
      ok: true,
      value: [{ saved: 1000, remaining: 9000, contributions: [] }],
    });
  } finally {
    await fixture.database.close();
  }
});

it('MONEY-001 refuses an aggregate overflow atomically and keeps existing contribution ownership', async () => {
  const fixture = await createTransactionFixture();
  try {
    const service = createGoalService(createGoalRepository(fixture.database), () => '2026-10-20');
    const goal: Goal = {
      id: 'goal',
      name: 'Large',
      target: 100,
      startingSaved: Number.MAX_SAFE_INTEGER,
      deadline: null,
      priority: 'low',
      desiredMonthly: 10,
      state: 'active',
    };
    await service.saveGoal({ operationId: 'g', input: goal });
    const before = await fixture.database.revision();
    expect(
      await service.saveContribution({
        operationId: 'bad',
        input: { id: 'c', goalId: 'goal', amount: 1, date: '2026-10-20' },
      }),
    ).toMatchObject({ ok: false, error: { code: 'amount-overflow' } });
    expect(await fixture.database.revision()).toBe(before);
    expect(await service.readGoals()).toMatchObject({
      ok: true,
      value: [{ saved: Number.MAX_SAFE_INTEGER, contributions: [] }],
    });
  } finally {
    await fixture.database.close();
  }
});
