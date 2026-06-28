import { Fragment, useState } from "react";
import FormButton from "./FormButton";
import { Heading } from "./ui/heading";
import { HStack } from "./ui/hstack";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "./ui/modal";
import { Text } from "./ui/text";

const ConfirmButton = ({
  onConfirm,
  confirmTitle,
  confirmDescription,
  confirmText,
  isDelete,
  ...buttonProps
}: {
  onConfirm: () => void | Promise<void>;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmText?: string;
  isDelete?: boolean;
} & React.ComponentProps<typeof FormButton>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Show the spinner inside the modal while the async action runs, combined
  // with any external `loading` the caller passes in.
  const loading = submitting || Boolean(buttonProps.loading);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm();
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <FormButton {...buttonProps} onPress={() => setIsOpen(true)} />
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => {
          if (!loading) setIsOpen(false);
        }}
        onConfirm={handleConfirm}
        loading={loading}
        isDelete={isDelete}
        confirmText={confirmText}
        title={confirmTitle}
        description={confirmDescription}
      />
    </Fragment>
  );
};

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
  isDelete,
  confirmText,
  title = "Confirm Action",
  description = "Are you sure you want to proceed?"
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  isDelete?: boolean;
  confirmText?: string;
  title?: string;
  description?: string;
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          <Heading size="lg">{title}</Heading>
        </ModalHeader>
        <ModalBody>
          <Text>{description}</Text>
        </ModalBody>
        <ModalFooter>
          <HStack className="gap-x-2">
            <FormButton
              variant="outline"
              text="Cancel"
              disabled={loading}
              onPress={onClose}
            />
            <FormButton
              text={confirmText ?? (isDelete ? "Delete" : "Confirm")}
              action={isDelete ? "negative" : "primary"}
              loading={loading}
              onPress={onConfirm}
            />
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmButton;
