import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Modal } from 'react-native';
import { Dialog } from 'react-native-paper';

type AppDialogProps = ComponentProps<typeof Dialog> & { readonly onDismiss: () => void };

/** Gives Material dialogs an Android window boundary so background controls cannot receive focus.
 * @param props Material content, visibility and dismissal policy, including busy-state back handling.
 * @returns A native modal window with keyboard-aware bounds retaining Paper's theme and composition.
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
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <Dialog {...props} />
    </KeyboardAvoidingView>
  </Modal>
);
