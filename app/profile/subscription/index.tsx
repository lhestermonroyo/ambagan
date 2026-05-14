import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import states from "@/states";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import {
  CheckCircle,
  Crown,
  Globe,
  HousePlus,
  TrendingUp,
  Users,
  XCircle
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, useColorScheme } from "react-native";

const MONTHLY_PRICE = 149;
const YEARLY_PRICE = 999;
const YEARLY_MONTHLY_EQUIV = Math.round(YEARLY_PRICE / 12);
const YEARLY_SAVINGS_PCT = Math.round(
  (1 - YEARLY_MONTHLY_EQUIV / MONTHLY_PRICE) * 100
);

const FEATURES: {
  icon: React.ElementType;
  label: string;
  free: string | null;
  pro: string;
}[] = [
  {
    icon: HousePlus,
    label: "Groups you can create",
    free: "Up to 3",
    pro: "Unlimited"
  },
  {
    icon: Globe,
    label: "Multi-currency expenses",
    free: null,
    pro: "14 currencies"
  },
  {
    icon: TrendingUp,
    label: "Settlement CSV export",
    free: null,
    pro: "Included"
  },
  {
    icon: Users,
    label: "Members inherit Pro features",
    free: null,
    pro: "Included"
  },
  {
    icon: Crown,
    label: "Pro badge on your groups",
    free: null,
    pro: "Included"
  }
];

type BillingPeriod = "monthly" | "yearly";

export default function SubscriptionScreen() {
  const { details: userDetails } = states.user();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const isPro = userDetails?.plan === "pro";
  const expiresAt = userDetails?.plan_expires_at;

  const currentPrice =
    billingPeriod === "monthly" ? MONTHLY_PRICE : YEARLY_PRICE;
  const priceLabel =
    billingPeriod === "monthly"
      ? `₱${MONTHLY_PRICE}/month`
      : `₱${YEARLY_PRICE}/year`;

  const handleUpgrade = () => {
    toast({
      title: "Coming Soon",
      description:
        "In-app purchase is being set up. Stay tuned for the official launch!",
      type: "info"
    });
  };

  const handleManage = () => {
    toast({
      title: "Manage Subscription",
      description:
        "To cancel or modify your subscription, go to your App Store or Play Store subscription settings.",
      type: "info"
    });
  };

  return (
    <InnerLayout title="Subscription" onBack={() => router.back()}>
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="gap-y-6 p-4 pb-10">
          <Box
            className={`rounded-2xl p-4 ${
              isPro
                ? "bg-warning-400"
                : "bg-background-50 border border-background-200"
            }`}
          >
            <VStack className="gap-y-4">
              <HStack className="items-center justify-between">
                <VStack className="gap-y-1">
                  <Text
                    className={`font-semibold uppercase ${isPro ? "text-warning-900" : "text-secondary-950"}`}
                  >
                    Current Plan
                  </Text>
                  <HStack className="items-center gap-x-2">
                    <Text
                      bold
                      className={`text-3xl ${isPro ? "text-background-0" : ""}`}
                    >
                      {isPro ? "Pro" : "Free"}
                    </Text>
                    {isPro && (
                      <Box className="bg-background-0 px-2 py-0.5 rounded-full">
                        <Text bold className="text-warning-400 text-xs">
                          ACTIVE
                        </Text>
                      </Box>
                    )}
                  </HStack>
                </VStack>
                <Crown
                  size={36}
                  color={isPro ? "rgba(255,255,255,0.8)" : "#d4a017"}
                />
              </HStack>

              {isPro && expiresAt && (
                <>
                  <Divider className="border-warning-300" />
                  <Text className="text-warning-950">
                    Renews on {format(new Date(expiresAt), "MMMM dd, yyyy")}
                  </Text>
                </>
              )}

              {!isPro && (
                <>
                  <Divider className="border-background-200" />
                  <Text className="text-secondary-950">
                    Upgrade to Pro to unlock multi-currency, CSV exports, and
                    unlimited groups.
                  </Text>
                </>
              )}
            </VStack>
          </Box>

          {/* Billing period toggle — only for free users */}
          {!isPro && (
            <VStack className="gap-y-2">
              <Text bold className="text-xl">
                Billing Period
              </Text>
              <HStack className="gap-x-2">
                <Pressable
                  className="flex-1"
                  onPress={() => setBillingPeriod("monthly")}
                >
                  <Box
                    className={`rounded-xl p-4 border items-center gap-y-1 ${
                      billingPeriod === "monthly"
                        ? "border-primary-400 bg-primary-50 dark:bg-primary-950"
                        : "border-background-200 bg-background-50"
                    }`}
                  >
                    <Text
                      bold
                      className={
                        billingPeriod === "monthly" ? "text-primary-400" : ""
                      }
                    >
                      Monthly
                    </Text>
                    <Text
                      bold
                      className={`text-xl ${billingPeriod === "monthly" ? "text-primary-400" : ""}`}
                    >
                      ₱{MONTHLY_PRICE}
                    </Text>
                    <Text className="text-secondary-950 text-sm">
                      per month
                    </Text>
                  </Box>
                </Pressable>

                <Pressable
                  className="flex-1"
                  onPress={() => setBillingPeriod("yearly")}
                >
                  <Box
                    className={`rounded-xl p-4 border items-center gap-y-1 ${
                      billingPeriod === "yearly"
                        ? "border-primary-400 bg-primary-50 dark:bg-primary-950"
                        : "border-background-200 bg-background-50"
                    }`}
                  >
                    <HStack className="items-center gap-x-1">
                      <Text
                        bold
                        className={
                          billingPeriod === "yearly" ? "text-primary-400" : ""
                        }
                      >
                        Yearly
                      </Text>
                      <Box className="bg-primary-400 px-1.5 py-0.5 rounded-full">
                        <Text className="text-background-0 text-xs font-bold">
                          -{YEARLY_SAVINGS_PCT}%
                        </Text>
                      </Box>
                    </HStack>
                    <Text
                      bold
                      className={`text-xl ${billingPeriod === "yearly" ? "text-primary-400" : ""}`}
                    >
                      ₱{YEARLY_PRICE}
                    </Text>
                    <Text className="text-secondary-950 text-sm">
                      ₱{YEARLY_MONTHLY_EQUIV}/month billed annually
                    </Text>
                  </Box>
                </Pressable>
              </HStack>
            </VStack>
          )}

          {/* Feature comparison */}
          <VStack className="gap-y-2">
            <Text bold className="text-xl">
              {isPro ? "Your Pro Features" : "Free vs Pro"}
            </Text>

            <Box className="bg-background-50 rounded-2xl overflow-hidden border border-background-200">
              {!isPro && (
                <HStack className="px-4 py-2 bg-background-100 gap-x-2">
                  <Text className="flex-1 text-secondary-950 font-medium">
                    Feature
                  </Text>
                  <Text className="w-20 text-center text-secondary-950 font-medium">
                    Free
                  </Text>
                  <Text className="w-20 text-center text-warning-500 font-medium">
                    Pro
                  </Text>
                </HStack>
              )}
              <FlatList
                scrollEnabled={false}
                data={FEATURES}
                keyExtractor={(item) => item.label}
                renderItem={({ item }) => (
                  <FeatureRow
                    item={item}
                    isPro={isPro}
                    colorScheme={colorScheme}
                  />
                )}
                ItemSeparatorComponent={ListDivider}
              />
            </Box>
          </VStack>

          {/* CTA */}
          {!isPro ? (
            <VStack className="gap-y-3">
              <FormButton
                text={`Upgrade to Pro — ${priceLabel}`}
                onPress={handleUpgrade}
              />
              <Text className="text-center text-secondary-950 text-sm leading-relaxed">
                In-app purchase via App Store / Play Store.{"\n"}Cancel anytime
                from your subscription settings.
              </Text>
            </VStack>
          ) : (
            <FormButton
              text="Manage Subscription"
              variant="outline"
              onPress={handleManage}
            />
          )}
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}

function FeatureRow({
  item,
  isPro,
  colorScheme
}: {
  item: (typeof FEATURES)[number];
  isPro: boolean;
  colorScheme: "light" | "dark";
}) {
  const { icon: FeatureIcon, label, free, pro } = item;

  return (
    <HStack className="p-4 items-center gap-x-2">
      <FeatureIcon
        size={16}
        color={getPrimaryHex("text-primary-400", colorScheme)}
      />
      <Text className="flex-1">{label}</Text>
      {!isPro && (
        <HStack className="w-20 justify-center">
          {free ? (
            <Text className="text-sm text-secondary-950 text-center">
              {free}
            </Text>
          ) : (
            <XCircle
              size={16}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          )}
        </HStack>
      )}
      <HStack className={`${isPro ? "" : "w-20"} justify-center`}>
        {isPro ? (
          <CheckCircle
            size={16}
            color={getPrimaryHex("text-primary-400", colorScheme)}
          />
        ) : (
          <Text className="text-sm text-warning-500 font-medium text-center">
            {pro}
          </Text>
        )}
      </HStack>
    </HStack>
  );
}
