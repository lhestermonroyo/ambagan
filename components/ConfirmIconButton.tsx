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
  iconSize,
  iconClassName,
  onConfirm,
  confirmTitle,
  confirmDescription,
  isDelete = false,
  isLoading = false,
  ...buttonProps
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  iconSize?: number;
  iconClassName?: string;
  onConfirm: () => void;
  confirmTitle?: string;
  confirmDescription?: string;
  isDelete?: boolean;
  isLoading?: boolean;
} & React.ComponentProps<typeof Button>) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    setIsOpen(false);
    onConfirm();
  };

  return (
    <Fragment>
      <Button {...buttonProps} onPress={() => setIsOpen(true)}>
        <Icon as={icon} size={iconSize || 24} className={iconClassName} />
      </Button>
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmDescription}
        isLoading={isLoading}
        isDelete={isDelete}
      />
    </Fragment>
  );
};

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  title = "Confirm Action",
  description = "Are you sure you want to proceed?",
  isDelete = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
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
          <Text className="text-sm text-secondary-950">{description}</Text>
        </ModalBody>
        <ModalFooter>
          <HStack className="gap-x-2">
            <FormButton
              variant="outline"
              text="Cancel"
              disabled={isLoading}
              onPress={onClose}
            />
            <FormButton
              text="Yes"
              action={isDelete ? "negative" : "primary"}
              loading={isLoading}
              onPress={onConfirm}
            />
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmIconButton;
