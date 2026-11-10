import { useI18n } from '@/shared/presentation/i18n';
import { PhosphorIcon } from '@/shared/presentation/phosphor-icon';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from 'react-native-paper';

/** Uses Android's native Material tab bar for implemented destinations only.
 * @returns Financial and settings tabs coordinated with Paper's color roles.
 */
const MainLayout = () => {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      tintColor={theme.colors.primary}
      iconColor={{ default: theme.colors.onSurfaceVariant, selected: theme.colors.primary }}
      indicatorColor={theme.colors.primaryContainer}
      labelStyle={{
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: '500',
        color: theme.colors.onSurface,
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={PhosphorIcon} name="house" />}
        />
        <NativeTabs.Trigger.Label>{t('Overview')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={PhosphorIcon} name="wallet" />}
        />
        <NativeTabs.Trigger.Label>{t('Plan')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={PhosphorIcon} name="receipt" />}
        />
        <NativeTabs.Trigger.Label>{t('Transactions')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={PhosphorIcon} name="flag" />}
        />
        <NativeTabs.Trigger.Label>{t('Goals')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={PhosphorIcon} name="gear" />}
        />
        <NativeTabs.Trigger.Label>{t('Settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
};
export default MainLayout;
