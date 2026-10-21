import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from 'react-native-paper';

/** Uses Android's native Material tab bar for implemented destinations only.
 * @returns Overview, planning, and transaction tabs coordinated with Paper's color roles.
 */
const MainLayout = () => {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      tintColor={theme.colors.primary}
      indicatorColor={theme.colors.primaryContainer}
      labelStyle={{
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: '500',
        color: theme.colors.onSurface,
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="home" />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon md="receipt_long" />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Icon md="flag" />
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
};
export default MainLayout;
