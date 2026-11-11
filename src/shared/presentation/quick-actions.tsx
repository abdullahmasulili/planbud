import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Keyboard, useWindowDimensions } from 'react-native';
import { FAB } from 'react-native-paper';
import { useI18n } from './i18n';
import { phosphorIcon } from './phosphor-icon';

const openActionsIcon = phosphorIcon('plus');
const closeActionsIcon = phosphorIcon('x');
const newPlanningIcon = phosphorIcon('notebook');
const recordSpendingIcon = phosphorIcon('receipt');

/** Gives Overview and Transactions the same floating actions and dismissal behavior.
 * @param props Actions supplied by the current screen.
 * @param props.onNewPlanning Opens a new named-plan draft.
 * @param props.onRecordSpending Opens a new transaction draft.
 * @returns A localized floating action menu above the native tabs.
 */
export const QuickActions = ({
  onNewPlanning,
  onRecordSpending,
}: {
  onNewPlanning: () => void;
  onRecordSpending: () => void;
}) => {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  useFocusEffect(
    useCallback(() => {
      if (!open) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setOpen(false);
        return true;
      });
      return () => subscription.remove();
    }, [open]),
  );

  return (
    <FAB.Group
      visible
      open={open}
      icon={open ? closeActionsIcon : openActionsIcon}
      accessibilityLabel={t(open ? 'Close quick actions' : 'Open quick actions')}
      onStateChange={({ open }) => {
        if (open) Keyboard.dismiss();
        setOpen(open);
      }}
      actions={[
        {
          icon: newPlanningIcon,
          label: t('New Planning'),
          size: 'medium',
          labelStyle: { maxWidth: width - 160 },
          onPress: onNewPlanning,
        },
        {
          icon: recordSpendingIcon,
          label: t('Record Spending'),
          size: 'medium',
          labelStyle: { maxWidth: width - 160 },
          onPress: onRecordSpending,
        },
      ]}
    />
  );
};
