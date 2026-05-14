import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
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
import { useRouter } from "expo-router";

const PRO_FEATURES = [
  {
    icon: "public",
    title: "Multi-currency expenses",
    description: "Add expenses in any currency — PHP, USD, JPY, SGD and more."
  },
  {
    icon: "groups",
    title: "Unlimited group creation",
    description: "Create as many groups as you need, no limits."
  },
  {
    icon: "download",
    title: "CSV export",
    description: "Export group settlements by date range for records or reimbursements."
  },
  {
    icon: "star",
    title: "Pro badge on your groups",
    description: "Members in your groups enjoy Pro features automatically."
  }
];

export default function UpgradeSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push("/profile/subscription");
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[70]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <HStack className="items-center gap-x-2">
              <Text bold className="text-2xl">
                Upgrade to
              </Text>
              <Box className="bg-warning-400 px-2 py-0.5 rounded-full">
                <Text bold className="text-background-0 text-sm">
                  PRO
                </Text>
              </Box>
            </HStack>
            <Text className="text-secondary-950">
              Unlock powerful features for you and your group members.
            </Text>
          </VStack>

          <VStack className="gap-y-6 p-4">
            <VStack className="gap-y-4">
              {PRO_FEATURES.map((feature) => (
                <HStack key={feature.title} className="gap-x-2 items-start">
                  <Box className="bg-primary-50 dark:bg-primary-900 p-2 rounded-full mt-0.5">
                    <Icon
                      as={feature.icon as any}
                      className="text-primary-400"
                    />
                  </Box>
                  <VStack className="flex-1">
                    <Text bold className="text-lg">
                      {feature.title}
                    </Text>
                    <Text className="text-secondary-950">
                      {feature.description}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>

            <FormButton text="See Plans & Pricing" onPress={handleUpgrade} />
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
