import type { ComponentProps } from 'react';
import { Modal } from 'react-native';
import { Dialog } from 'react-native-paper';

type AppDialogProps = ComponentProps<typeof Dialog> & { readonly onDismiss: () => void };

/** Gives Material dialogs an Android window boundary so background controls cannot receive focus.
 * @param props Material content, visibility and dismissal policy, including busy-state back handling.
 * @returns A native modal window retaining Paper's theme, shape and dialog composition.
 */
export const AppDialog = (props: AppDialogProps) => (
  <Modal
    visible={props.visible}
    transparent
    animationType="none"
    testID="dialog-window"
    onRequestClose={() => {
      if (props.dismissableBackButton ?? props.dismissable ?? true) props.onDismiss();
    }}
  >
    <Dialog {...props} />
  </Modal>
);
