import { render, screen } from '@testing-library/react-native';
import { TestScreen } from '../../../tests/helpers/test-screen';
import { BudgetGauge, ComparisonChart } from './charts';

it('UI-009 exposes exact overspending without clipping the percentage to 100', async () => {
  await render(
    <TestScreen>
      <BudgetGauge label="Spending used" value={125} limit={100} />
    </TestScreen>,
  );
  expect(screen.getByRole('progressbar', { name: 'Spending used' })).toHaveAccessibilityValue({
    min: 0,
    max: 100,
    now: 100,
    text: '125%',
  });
  expect(screen.getByText('125%')).toBeOnTheScreen();
});
it('UI-009 represents zero funding explicitly, without NaN or a misleading percentage', async () => {
  await render(
    <TestScreen>
      <BudgetGauge label="Allocated" value={1} limit={0} />
    </TestScreen>,
  );
  expect(screen.getByText('No limit set')).toBeOnTheScreen();
  expect(screen.queryByText('NaN%')).toBeNull();
});
it('UI-009 keeps exact comparison labels for screen readers', async () => {
  await render(
    <TestScreen>
      <ComparisonChart
        label="Food"
        first={{ label: 'Limit', value: 10, formatted: '$10.00' }}
        second={{ label: 'Spent', value: 12, formatted: '$12.00' }}
      />
    </TestScreen>,
  );
  expect(screen.getByText('Limit · $10.00')).toBeOnTheScreen();
  expect(screen.getByText('Spent · $12.00')).toBeOnTheScreen();
});
