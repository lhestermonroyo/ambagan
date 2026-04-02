import { Fragment, useState } from "react";
import FormButton from "./FormButton";
import Icon from "./Icon";
import { Button } from "./ui/button";
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

const ConfirmIconButton = ({
  icon,
  iconClassName,
  onConfirm,
  confirmTitle,
  confirmDescription,
  isDelete = false,
  ...buttonProps
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  iconClassName?: string;
  onConfirm: () => void;
  confirmTitle?: string;
  confirmDescription?: string;
  isDelete?: boolean;
} & React.ComponentProps<typeof Button>) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    setIsOpen(false);
    onConfirm();
  };

  return (
    <Fragment>
      <Button {...buttonProps} onPress={() => setIsOpen(true)}>
        <Icon as={icon} className={iconClassName} />
      </Button>
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmDescription}
        isDelete={isDelete}
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
  description = "Are you sure you want to proceed?",
  isDelete = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  description?: string;
  isDelete: boolean;
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
              text="Yes"
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

export default ConfirmIconButton;
