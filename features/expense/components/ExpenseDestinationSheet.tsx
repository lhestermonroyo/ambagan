import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex } from "@/utils/getColorHex";
import { NotebookPen, Users } from "lucide-react-native";
import { useColorScheme } from "react-native";

/**
 * Group-vs-Personal chooser. Both the Overview "Add Expense" button and the
 * post-scan hand-off need the user to say which kind of expense they mean, since
 * groups and personal books both have an Add Expense flow. Kept generic (title /
 * subtitle are passed in) so the "adding" and "scanned receipt" wordings share
 * one sheet.
 */
export default function ExpenseDestinationSheet({
  isOpen,
  onClose,
  onSelectGroup,
  onSelectPersonal,
  title = "What are you adding?",
  subtitle
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectGroup: () => void;
  onSelectPersonal: () => void;
  title?: string;
  subtitle?: string;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const iconColor = getPrimaryHex("text-primary-500", colorScheme);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full">
          <VStack className="p-4">
            <Text bold className="text-xl">
              {title}
            </Text>
            {subtitle && (
              <Text className="text-sm text-secondary-950 pb-2">
                {subtitle}
              </Text>
            )}
          </VStack>

          <Option
            icon={<Users color={iconColor} />}
            title="Group expense"
            description="Split a bill with people in a group."
            onPress={onSelectGroup}
          />
          <Option
            icon={<NotebookPen color={iconColor} />}
            title="Personal expense"
            description="Track your own spending in a book."
            onPress={onSelectPersonal}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function Option({
  icon,
  title,
  description,
  onPress
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <PressableListItem onPress={onPress}>
      <HStack className="p-4 gap-x-3 items-start justify-start">
        <Box className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
          {icon}
        </Box>
        <VStack className="flex-1">
          <Text className="text-lg">{title}</Text>
          <Text className="text-secondary-950 text-sm">{description}</Text>
        </VStack>
        <HStack className="gap-x-2 items-center self-center">
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
