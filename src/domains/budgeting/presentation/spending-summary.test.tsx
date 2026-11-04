import { render, screen } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import type { BudgetOverview } from '../application/overview-service';
import type { Profile } from '@/domains/settings/application/public';
import { SpendingSummary } from './spending-summary';

const profile: Profile = {
  id: 'p',
  currency: { code: 'USD', exponent: 2 },
  locale: 'en-US',
  appearance: 'system',
};
const overview: BudgetOverview = {
  month: '2026-11',
  plannedIncome: 0,
  actualIncome: 0,
  plannedSpending: 2000,
  actualSpending: 4000,
  remainingSpending: -2000,
  categories: [
    { id: 'transport', name: 'Transport', limit: 1000, spent: 1000, remaining: 0 },
    { id: 'food', name: 'Food', limit: 1000, spent: 3000, remaining: -2000 },
    { id: 'unused', name: 'Unused', limit: 0, spent: 0, remaining: 0 },
  ],
};

it('MONEY-003 summarizes actual spending with exact amounts, shares, and matching donut segments', async () => {
  await render(
    <TestScreen>
      <SpendingSummary data={overview} profile={profile} />
    </TestScreen>,
  );
  expect(screen.getByText('$40.00')).toBeOnTheScreen();
  expect(screen.getByText('$30.00 · 75%')).toBeOnTheScreen();
  expect(screen.getByText('$10.00 · 25%')).toBeOnTheScreen();
  expect(screen.queryByText('Unused')).toBeNull();
  const segments = screen.getAllByTestId('spending-segment', { includeHiddenElements: true });
  expect(segments).toHaveLength(2);
  expect(segments[0]?.props.strokeDasharray[0]).toBeCloseTo(2 * Math.PI * 80 * 0.75);
  expect(segments[1]?.props.strokeDashoffset).toBeCloseTo(-2 * Math.PI * 80 * 0.75);
  expect(overview.categories[0]?.name).toBe('Transport');
});

it('UI-006 shows an empty ring and next action when the selected month has no spending', async () => {
  await render(
    <TestScreen>
      <SpendingSummary
        data={{ ...overview, actualSpending: 0, categories: [] }}
        profile={profile}
      />
    </TestScreen>,
  );
  expect(screen.getByText('$0.00')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'No spending this month. Record an expense in Transactions to see your breakdown.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByTestId('spending-track', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.queryAllByTestId('spending-segment', { includeHiddenElements: true })).toHaveLength(
    0,
  );
});
