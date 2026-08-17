import AppDatePicker from "@/components/AppDatePicker";
import { Heading } from "@/components/ui/heading";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalHeader
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";

type DatePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** The currently selected day. */
  value: Date;
  /** Fired when the user taps a day. */
  onChange: (date: Date) => void;
  /** Modal heading. Defaults to the expense-form copy. */
  title?: string;
  /** Whether picking a day should close the modal. Defaults to true. */
  closeOnSelect?: boolean;
};

/**
 * The app's inline-calendar modal: a centered {@link Modal} wrapping
 * {@link AppDatePicker} with a title. Shared by the expense forms (add/edit,
 * group + book) so every "Select Expense Date" picker looks and behaves the same.
 */
export default function DatePickerModal({
  isOpen,
  onClose,
  value,
  onChange,
  title = "Select Expense Date",
  closeOnSelect = true
}: DatePickerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="lg">{title}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack className="items-center">
            <AppDatePicker
              value={value}
              onChange={(date) => {
                onChange(date);
                if (closeOnSelect) onClose();
              }}
            />
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
