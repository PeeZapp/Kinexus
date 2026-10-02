import { type ReactNode } from 'react';
import { Modal } from 'react-native';

export type AppModalProps = {
  visible?: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  children: ReactNode;
};

export function AppModal({
  visible = false,
  transparent,
  animationType = 'none',
  onRequestClose,
  children,
}: AppModalProps) {
  return (
    <Modal visible={visible} transparent={transparent} animationType={animationType} onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}
