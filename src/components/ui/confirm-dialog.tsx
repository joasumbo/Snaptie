"use client";

import Button from "@atlaskit/button/new";
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";

type Props = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  isLoading,
  onConfirm,
  onClose,
}: Props) {
  return (
    <ModalTransition>
      {open && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <ModalTitle appearance="danger">{title}</ModalTitle>
          </ModalHeader>
          <ModalBody>{message}</ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={onClose} isDisabled={isLoading}>
              Cancelar
            </Button>
            <Button appearance="danger" onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
}
