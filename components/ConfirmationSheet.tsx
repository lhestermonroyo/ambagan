import type { ReactNode } from "react";
import AppSheet from "./AppSheet";
import FormButton from "./FormButton";
import { ScrollView } from "./ui/scroll-view";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export default function ConfirmationSheet({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDelete = false,
  loading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDelete?: boolean;
  loading?: boolean;
}) {
  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={handleClose}
      snapPoints={[40]}
      footer={
        <VStack className="w-full p-4 gap-y-2">
          <FormButton
            text={confirmText}
            action={isDelete ? "negative" : "primary"}
            loading={loading}
            onPress={onConfirm}
          />
          <FormButton
            text={cancelText}
            variant="outline"
            disabled={loading}
            onPress={handleClose}
          />
        </VStack>
      }
    >
      <VStack className="p-4">
        <Text bold className="text-xl">{title}</Text>
      </VStack>
      <ScrollView className="flex-1">
        <Text className="px-4">{description}</Text>
      </ScrollView>
    </AppSheet>
  );
}
