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
  ...buttonProps
}: {
  onConfirm: () => void;
  confirmTitle?: string;
  confirmDescription?: string;
} & React.ComponentProps<typeof FormButton>) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    setIsOpen(false);
    onConfirm();
  };

  return (
    <Fragment>
      <FormButton {...buttonProps} onPress={() => setIsOpen(true)} />
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
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
  title = "Confirm Action",
  description = "Are you sure you want to proceed?"
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
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
            <FormButton text="Confirm" loading={loading} onPress={onConfirm} />
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmButton;
