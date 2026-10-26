import { Fragment, useState } from "react";
import FormButton from "./FormButton";
import ConfirmationSheet from "./ConfirmationSheet";

const ConfirmButton = ({
  onConfirm,
  confirmTitle,
  confirmDescription,
  confirmText,
  confirmIcon,
  isDelete,
  ...buttonProps
}: {
  onConfirm: () => void | Promise<void>;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmText?: string;
  confirmIcon?: React.ComponentProps<typeof ConfirmationSheet>["icon"];
  isDelete?: boolean;
} & React.ComponentProps<typeof FormButton>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Show the spinner inside the sheet while the async action runs, combined
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
      <ConfirmationSheet
        isOpen={isOpen}
        onClose={() => {
          if (!loading) setIsOpen(false);
        }}
        onConfirm={handleConfirm}
        loading={loading}
        isDelete={isDelete}
        icon={confirmIcon}
        confirmText={confirmText ?? (isDelete ? "Delete" : "Confirm")}
        title={confirmTitle}
        description={confirmDescription}
      />
    </Fragment>
  );
};

export default ConfirmButton;
