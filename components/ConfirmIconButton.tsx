import { Fragment, useState } from "react";
import ConfirmationSheet from "./ConfirmationSheet";
import Icon from "./Icon";
import { Button } from "./ui/button";

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
      <ConfirmationSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmDescription}
        loading={isLoading}
        confirmText="Yes"
        isDelete={isDelete}
      />
    </Fragment>
  );
};

export default ConfirmIconButton;
