import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";

import { useRouter } from "expo-router";
import { Crown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

type PlanType = "two_week" | "monthly" | "yearly";

const TWO_WEEK_PRICE = 99;
const MONTHLY_PRICE = 149;
const YEARLY_PRICE = 799;
const YEARLY_SAVINGS_PCT = Math.round(
  (1 - YEARLY_PRICE / (MONTHLY_PRICE * 12)) * 100
);

const FEATURES = [
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
    icon: "autorenew",
    title: "Recurring expenses",
    description: "Auto-generate monthly expenses like rent and subscriptions."
  },
  {
    icon: "star",
    title: "All future updates included",
    description: "New Pro features as they ship — yours forever."
  }
];

const PLANS: {
  key: PlanType;
  label: string;
  sublabel?: string;
  badge?: string;
  fallbackPrice: number;
  fallbackSuffix: string;
}[] = [
  {
    key: "two_week",
    label: "2 Weeks",
    sublabel: "Great for a single trip",
    fallbackPrice: TWO_WEEK_PRICE,
    fallbackSuffix: "/ 2 wks"
  },
  {
    key: "monthly",
    label: "Monthly",
    sublabel: "Most flexible — cancel anytime",
    fallbackPrice: MONTHLY_PRICE,
    fallbackSuffix: "/ mo"
  },
  {
    key: "yearly",
    label: "Yearly",
    sublabel: `₱${Math.round(YEARLY_PRICE / 12)}/mo · best value`,
    badge: `Save ${YEARLY_SAVINGS_PCT}%`,
    fallbackPrice: YEARLY_PRICE,
    fallbackSuffix: "/ yr"
  }
];

export default function SubscriptionScreen() {
  const { details: userDetails } = states.user();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");

  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const isPro = userDetails?.plan === "pro";

  const twoWeekPkg = offering
    ? services.purchase.getTwoWeekPackage(offering)
    : undefined;
  const monthlyPkg = offering
    ? services.purchase.getMonthlyPackage(offering)
    : undefined;
  const yearlyPkg = offering
    ? services.purchase.getYearlyPackage(offering)
    : undefined;

  const pkgMap: Record<PlanType, PurchasesPackage | undefined> = {
    two_week: twoWeekPkg,
    monthly: monthlyPkg,
    yearly: yearlyPkg
  };

  const activePkg = pkgMap[selectedPlan];

  const getPriceLabel = (
    pkg: PurchasesPackage | undefined,
    fallback: number
  ) =>
    pkg
      ? `₱${Math.round(pkg.product.price).toLocaleString("en-PH")}`
      : `₱${fallback}`;

  const ctaLabel = () => {
    const plan = PLANS.find((p) => p.key === selectedPlan)!;
    const price = getPriceLabel(pkgMap[selectedPlan], plan.fallbackPrice);
    return `Subscribe — ${price} ${plan.fallbackSuffix}`;
  };

  useEffect(() => {
    fetchOffering();
  }, []);

  const fetchOffering = async () => {
    setLoadingOffering(true);
    try {
      const current = await services.purchase.getOfferings();
      setOffering(current);
    } catch (error) {
      console.error("Failed to fetch offerings:", error);
    } finally {
      setLoadingOffering(false);
    }
  };

  const handleSubscribe = async () => {
    if (!activePkg) {
      toast({
        title: "Product Unavailable",
        description:
          "Could not load the purchase product. Please try again later.",
        type: "error"
      });
      return;
    }

    setPurchasing(true);
    try {
      const customerInfo = await services.purchase.purchasePackage(activePkg);
      const { plan } = await services.purchase.syncPlanToSupabase(customerInfo);

      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at: null }
          : prev.details
      }));

      toast({
        title: "Welcome to Pro!",
        description: "No daily limits — enjoy all features.",
        type: "success"
      });
    } catch (error) {
      console.error("Purchase failed:", error);
      if (services.purchase.isPurchaseCancelled(error)) return;
      toast({
        title: "Purchase Failed",
        description: "Could not complete the purchase. Please try again.",
        type: "error"
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const customerInfo = await services.purchase.restorePurchases();
      const { plan } = await services.purchase.syncPlanToSupabase(customerInfo);

      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at: null }
          : prev.details
      }));

      const restored = plan === "pro";
      toast({
        title: restored ? "Purchase Restored" : "No Purchase Found",
        description: restored
          ? "Your Ambagan Pro has been restored."
          : "No previous purchase found for this account.",
        type: restored ? "success" : "info"
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Could not restore purchase. Please try again.",
        type: "error"
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      await services.purchase.showManageSubscriptions();
    } catch (error) {
      toast({
        title: "Unable to open",
        description:
          "Could not open subscription management. Try via Settings → Apple ID → Subscriptions.",
        type: "error"
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  return (
    <InnerLayout title="Subscription" onBack={() => router.back()}>
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4 pb-10">
          {/* Pro status card — shown to Pro users */}
          {isPro && (
            <Box className="rounded-2xl p-4 bg-warning-400">
              <VStack className="gap-y-4">
                <HStack className="items-center justify-between">
                  <VStack className="gap-y-1">
                    <Text className="font-semibold uppercase text-warning-900">
                      Current Plan
                    </Text>
                    <HStack className="items-center gap-x-2">
                      <Text bold className="text-3xl text-background-0">
                        Pro
                      </Text>
                      <Box className="bg-background-0 px-2 py-0.5 rounded-full">
                        <Text bold className="text-warning-400 text-xs">
                          ACTIVE
                        </Text>
                      </Box>
                    </HStack>
                  </VStack>
                  <Crown size={36} color="rgba(255,255,255,0.8)" />
                </HStack>
                <Divider className="border-warning-300" />
                <Text className="text-warning-950">
                  Thank you for your support! 🎉
                </Text>
              </VStack>
            </Box>
          )}

          {/* Upgrade header — free users */}
          {!isPro && (
            <VStack className="gap-y-1">
              <HStack className="items-center gap-x-2">
                <Text bold className="text-2xl">
                  Upgrade to
                </Text>
                <Box className="bg-warning-400 px-2 py-0.5 rounded-full">
                  <Text bold className="text-background-0 text-sm">
                    PRO
                  </Text>
                </Box>
                {loadingOffering && (
                  <ActivityIndicator
                    size="small"
                    color={getPrimaryHex("text-primary-400", colorScheme)}
                  />
                )}
              </HStack>
              <Text className="text-sm text-secondary-950">
                One subscription, all features — cancel anytime.
              </Text>
            </VStack>
          )}

          {/* Feature list */}
          <VStack className="gap-y-2">
            <Text bold className="text-lg">
              {isPro ? "Your Pro Features" : "What you get"}
            </Text>
            <Box className="rounded-2xl overflow-hidden bg-background-50">
              {FEATURES.map((feature, index) => (
                <Box key={feature.title}>
                  <HStack className="gap-x-3 items-start p-4">
                    <Box className="bg-primary-50 dark:bg-primary-900 p-2 rounded-full mt-0.5">
                      <Icon
                        as={feature.icon as any}
                        className="text-primary-400"
                      />
                    </Box>
                    <VStack className="flex-1">
                      <Text bold className="text-base">
                        {feature.title}
                      </Text>
                      <Text className="text-secondary-950 text-sm">
                        {feature.description}
                      </Text>
                    </VStack>
                  </HStack>
                  {index < FEATURES.length - 1 && <ListDivider />}
                </Box>
              ))}
            </Box>
          </VStack>

          {/* Plan cards — free users only */}
          {!isPro && (
            <VStack className="gap-y-2">
              <Text bold className="text-lg">
                Choose a plan
              </Text>
              <VStack className="gap-y-2">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.key;
                  const priceLabel = getPriceLabel(
                    pkgMap[plan.key],
                    plan.fallbackPrice
                  );

                  return (
                    <Pressable
                      key={plan.key}
                      onPress={() => setSelectedPlan(plan.key)}
                    >
                      <Box
                        className={`rounded-2xl p-4 ${
                          isSelected
                            ? "bg-primary-50 dark:bg-primary-950"
                            : "bg-background-50"
                        }`}
                      >
                        <HStack className="items-center justify-between">
                          <VStack className="gap-y-0.5 flex-1">
                            <HStack className="items-center gap-x-2">
                              <Text bold className="text-lg">
                                {plan.label}
                              </Text>
                              {plan.badge && (
                                <Box className="bg-success-400 px-2 py-0.5 rounded-full">
                                  <Text
                                    bold
                                    className="text-background-0 text-xs"
                                  >
                                    {plan.badge}
                                  </Text>
                                </Box>
                              )}
                            </HStack>
                            {plan.sublabel && (
                              <Text className="text-secondary-950 text-sm">
                                {plan.sublabel}
                              </Text>
                            )}
                          </VStack>

                          <HStack className="items-center gap-x-4">
                            <Text
                              bold
                              className={`text-xl ${isSelected ? "text-primary-400" : ""}`}
                            >
                              {priceLabel}
                              <Text
                                className={`text-sm font-normal ${isSelected ? "text-primary-400" : "text-secondary-950"}`}
                              >
                                {" "}
                                {plan.fallbackSuffix}
                              </Text>
                            </Text>

                            {/* Radio button */}
                            <Box
                              className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                                isSelected
                                  ? "border-primary-400 bg-primary-400"
                                  : "border-secondary-400 bg-transparent"
                              }`}
                            >
                              {isSelected && (
                                <Box className="w-2 h-2 rounded-full bg-background-0" />
                              )}
                            </Box>
                          </HStack>
                        </HStack>
                      </Box>
                    </Pressable>
                  );
                })}
              </VStack>
            </VStack>
          )}

          {/* CTA — free users */}
          {!isPro && (
            <VStack className="gap-y-3">
              <FormButton
                text={ctaLabel()}
                loading={purchasing}
                disabled={purchasing || restoring || loadingOffering}
                onPress={handleSubscribe}
              />
              <FormButton
                text="Restore Purchase"
                variant="outline"
                loading={restoring}
                disabled={purchasing || restoring}
                onPress={handleRestore}
              />
              <Text className="text-center text-secondary-950 text-sm leading-relaxed">
                Subscription renews automatically.{"\n"}
                Cancel anytime via App Store settings.
              </Text>
            </VStack>
          )}

          {/* CTA — Pro users */}
          {isPro && (
            <FormButton
              text="Manage Subscription"
              variant="outline"
              loading={managingSubscription}
              onPress={handleManageSubscription}
            />
          )}
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
