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
import { getSecondaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useColorScheme } from "react-native";

const PRO_FEATURES = [
  {
    icon: "bolt",
    title: "No daily expense limit",
    description: "Add as many expenses as you need — no daily cap, ever."
  },
  {
    icon: "download",
    title: "Export settlements as CSV",
    description: "Download settlements by date range for your records."
  },
  {
    icon: "trending-up",
    title: "Spending analytics",
    description: "See where your money goes — by group, by month, by friend."
  },
  {
    icon: "currency-exchange",
    title: "Multi-currency expenses",
    description: "Split bills in any currency — PHP, USD, JPY, and more."
  },
  {
    icon: "star",
    title: "All future updates included",
    description: "New Pro features as they ship — yours forever."
  }
];

export default function UpgradeSheet({
  isOpen,
  onClose,
  description
}: {
  isOpen: boolean;
  onClose: () => void;
  description?: string;
}) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const handleUpgrade = () => {
    onClose();
    router.push("/profile/subscription");
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[75]}>
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
            <Text className="text-sm text-secondary-950">
              {description ??
                "One-time purchase · No subscription · No renewal"}
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
                    <Text className="text-sm text-secondary-950">
                      {feature.description}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </VStack>
        <Box className="p-4 w-full">
          <FormButton
            text="Explore Pro Options"
            iconEnd={
              <ArrowRight
                size={18}
                color={getSecondaryHex("text-secondary-0", colorScheme)}
              />
            }
            onPress={handleUpgrade}
          />
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
