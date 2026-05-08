import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import InnerLayout from "@/layouts/InnerLayout";
import { currencies } from "@/utils/constants";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import {
  BadgeCheck,
  Bell,
  Coins,
  Globe,
  LayoutDashboard,
  Receipt,
  SplitSquareHorizontal,
  Users,
  Wallet
} from "lucide-react-native";
import { useColorScheme } from "react-native";

const VERSION = "1.0.0";

const features = [
  {
    icon: Users,
    title: "Groups",
    description:
      "Create shared expense groups for trips, events, households, work, couples, or family."
  },
  {
    icon: Receipt,
    title: "Expenses with Receipts",
    description:
      "Log expenses with descriptions, dates, and optional proof-of-payment photo."
  },
  {
    icon: SplitSquareHorizontal,
    title: "Flexible Splits",
    description:
      "Split expenses equally, by percentage, or with fully customized amounts per member."
  },
  {
    icon: Wallet,
    title: "Settlements",
    description:
      "Track who owes what. Request payment, mark as settled, and review settlement history."
  },
  {
    icon: Users,
    title: "Friends & Favorites",
    description:
      "Add friends as favorites for quick access and view balance summaries across shared groups."
  },
  {
    icon: Coins,
    title: "Multi-Currency",
    description: `Supports ${currencies.length} currencies including PHP, USD, EUR, JPY, SGD, and more. Set your default currency per account.`
  },
  {
    icon: LayoutDashboard,
    title: "Snapshot Dashboard",
    description:
      "Get a quick overview of your total amount to collect and to pay across all groups."
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description:
      "Stay updated with real-time alerts for settlement requests and confirmations."
  },
  {
    icon: Globe,
    title: "Light & Dark Mode",
    description:
      "Choose between light, dark, or system appearance to match your preference."
  },
  {
    icon: BadgeCheck,
    title: "Secure & Private",
    description:
      "Your data is stored securely. Passwords are never stored in plain text."
  }
];

export default function AboutScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  return (
    <InnerLayout title="About" onBack={() => router.back()}>
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="gap-y-6 pb-8">
          <Box className="bg-primary-400 items-center justify-center py-10 gap-y-2">
            <Text bold className="text-4xl text-background-0">
              ambagan
            </Text>
            <Text className="text-background-0 opacity-80">
              Version {VERSION}
            </Text>
          </Box>

          <VStack className="px-4 gap-y-2">
            <Text bold className="text-xl">
              What is Ambagan?
            </Text>
            <Text className="text-secondary-950 leading-relaxed">
              Ambagan is a group expense splitting app designed for Filipinos
              and anyone who shares costs with others. Whether you're on a trip,
              splitting household bills, or settling group dinners — Ambagan
              keeps everyone on the same page.
            </Text>
          </VStack>

          <VStack className="px-4 gap-y-4">
            <Text bold className="text-xl">
              Features
            </Text>
            <Box className="bg-secondary-100 rounded-xl overflow-hidden">
              <FlatList
                scrollEnabled={false}
                data={features}
                keyExtractor={(item) => item.title}
                renderItem={({ item: feature }) => (
                  <HStack className="p-4 gap-x-2 items-start">
                    <Box className="mt-0.5">
                      <feature.icon
                        size={20}
                        color={getPrimaryHex("text-primary-400", colorScheme)}
                      />
                    </Box>
                    <VStack className="flex-1 gap-y-0.5">
                      <Text className="text-lg">{feature.title}</Text>
                      <Text className="text-secondary-950">
                        {feature.description}
                      </Text>
                    </VStack>
                  </HStack>
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                )}
              />
            </Box>
          </VStack>

          <VStack className="px-4 gap-y-4">
            <Text bold className="text-xl">
              App Info
            </Text>
            <Box className="bg-secondary-100 rounded-xl overflow-hidden">
              <FlatList
                scrollEnabled={false}
                data={[
                  { label: "Version", value: VERSION },
                  { label: "Platform", value: "iOS & Android" },
                  {
                    label: "Supported Currencies",
                    value: `${currencies.length} currencies`
                  },
                  { label: "Developer", value: "lhestermonroyo" }
                ]}
                keyExtractor={(item) => item.label}
                renderItem={({ item }) => (
                  <HStack className="p-4 gap-x-2 justify-between items-center">
                    <Text className="text-secondary-950">{item.label}</Text>
                    <Text>{item.value}</Text>
                  </HStack>
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                )}
              />
            </Box>
          </VStack>

          <Text className="text-center text-secondary-950 text-sm px-4">
            Built with love for the Philippines
          </Text>
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
