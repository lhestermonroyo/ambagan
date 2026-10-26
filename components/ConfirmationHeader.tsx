import { CircleHelp, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Box } from "./ui/box";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export default function ConfirmationHeader({
  title,
  icon = CircleHelp,
  destructive = false
}: {
  title: ReactNode;
  icon?: LucideIcon;
  destructive?: boolean;
}) {
  return (
    <VStack className="p-4 items-start gap-y-3">
      <Box
        className={`h-16 w-16 rounded-full items-center justify-center shrink-0 ${destructive ? "bg-error-500" : "bg-primary-500"}`}
      >
        <Icon as={icon} size={40} className="text-white" accessible={false} />
      </Box>
      <Text bold className="text-2xl">
        {title}
      </Text>
    </VStack>
  );
}
