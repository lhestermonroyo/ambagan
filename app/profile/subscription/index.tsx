import AppBadge from "@/components/AppBadge";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import ProBadge from "@/components/ProBadge";
import RadioButton from "@/components/RadioButton";
import { SubscriptionPlanSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PRO_FEATURES } from "@/constants/proFeatures";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";

import { differenceInCalendarDays, format } from "date-fns";
import { Stack, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Image } from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

// The hexagon badge is filled with primary-500, which flips per scheme — pair
// the art to the active scheme so it doesn't fight the card behind it.
const PRO_BADGE = {
  light: require("@/assets/images/pro-light.png"),
  dark: require("@/assets/images/pro-dark.png")
};

type PlanType = "two_week" | "monthly" | "yearly";

const TWO_WEEK_PRICE = 99;
const MONTHLY_PRICE = 149;
const YEARLY_PRICE = 799;
const YEARLY_SAVINGS_PCT = Math.round(
  (1 - YEARLY_PRICE / (MONTHLY_PRICE * 12)) * 100
);

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
    sublabel: `₱${Math.round(YEARLY_PRICE / 12)}/mo • best value`,
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
  const { colorScheme } = useColorScheme();
  const tintColor = getPrimaryHex("text-primary-600", colorScheme ?? "light");

  const isPro = userDetails?.plan === "pro";

  // `plan_expires_at` is either a subscription's next renewal or the end of a
  // 2-week pass window — the user row doesn't say which, so the copy stays
  // neutral about what happens on that date and only promises access up to it.
  const proStatusLine = (() => {
    const expiresAt = userDetails?.plan_expires_at;
    if (!expiresAt) {
      return "Your Pro access is active — manage or cancel anytime in the App Store.";
    }

    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      return "Your Pro access is active — manage or cancel anytime in the App Store.";
    }

    const daysLeft = differenceInCalendarDays(expiry, new Date());
    const remaining =
      daysLeft <= 0
        ? "ends today"
        : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;

    return `Pro access through ${format(expiry, "MMM d, yyyy")} • ${remaining}`;
  })();

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
    // The 2-week pass is a one-off purchase, not a subscription.
    const verb = selectedPlan === "two_week" ? "Get Pro" : "Subscribe";
    return `${verb} — ${price} ${plan.fallbackSuffix}`;
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

      // The 2-week pass is a consumable — it grants no recurring entitlement,
      // so we stamp a 14-day window ourselves, stacking onto any unexpired
      // window so an early repurchase never loses days. Auto-renewable plans
      // let RevenueCat's active entitlement drive the expiry.
      const { plan, plan_expires_at } =
        await services.purchase.syncPlanToSupabase(
          customerInfo,
          selectedPlan === "two_week"
            ? {
                setWindowExpiresAt: services.purchase.computeTwoWeekExpiry(
                  userDetails?.plan_expires_at ?? null
                )
              }
            : undefined
        );

      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at }
          : prev.details
      }));

      toast({
        title: "Welcome to Pro!",
        description:
          selectedPlan === "two_week"
            ? "Your 2-week Pro pass is active — enjoy all features."
            : "No daily limits — enjoy all features.",
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
      const { plan, plan_expires_at } =
        await services.purchase.syncPlanToSupabase(customerInfo, {
          currentWindowExpiresAt: userDetails?.plan_expires_at ?? null
        });

      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at }
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
    } catch {
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
    } catch {
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
    <InnerLayout
      title="Subscription"
      onBack={() => router.back()}
      actions={
        isPro ? undefined : (
          <Stack.Toolbar.Button
            variant="plain"
            tintColor={tintColor}
            disabled={purchasing || restoring}
            accessibilityLabel="Restore purchase"
            onPress={handleRestore}
          >
            {restoring ? "Restoring..." : "Restore"}
          </Stack.Toolbar.Button>
        )
      }
      androidActions={
        isPro ? undefined : (
          <Pressable
            className="pr-1"
            disabled={purchasing || restoring}
            aria-label="Restore purchase"
            onPress={handleRestore}
          >
            <Text
              className="font-medium"
              style={{
                color: tintColor,
                opacity: purchasing || restoring ? 0.4 : 1
              }}
            >
              {restoring ? "Restoring..." : "Restore"}
            </Text>
          </Pressable>
        )
      }
    >
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4 pb-10">
          {/* Pro status card — shown to Pro users */}
          {isPro && (
            <Box className="rounded-2xl p-4 bg-primary-50">
              <VStack className="gap-y-4">
                <HStack className="items-center gap-x-4">
                  <Image
                    source={
                      PRO_BADGE[colorScheme === "dark" ? "dark" : "light"]
                    }
                    style={{ width: 56, height: 56 }}
                    resizeMode="contain"
                  />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="font-semibold uppercase text-primary-600 text-sm">
                      Current Plan
                    </Text>
                    <HStack className="items-center gap-x-2">
                      <Text bold className="text-2xl text-primary-700">
                        Ambagan Pro
                      </Text>
                      <AppBadge text="ACTIVE" action="success" />
                    </HStack>
                  </VStack>
                </HStack>
                <Divider className="bg-primary-600" />
                <HStack className="items-center gap-x-2">
                  <Box className="mt-0.5">
                    <Icon
                      as="event-available"
                      size={18}
                      className="text-primary-600"
                    />
                  </Box>
                  <Text className="flex-1 text-sm text-primary-700">
                    {proStatusLine}
                  </Text>
                </HStack>
              </VStack>
            </Box>
          )}

          {/* Upgrade header — free users */}
          {!isPro && (
            <VStack className="gap-y-1 items-center">
              <HStack className="items-center gap-x-2">
                <Text bold className="text-3xl">
                  Upgrade to
                </Text>
                <ProBadge size="lg" />
              </HStack>
              <Text className="text-secondary-950">
                One subscription, all features — cancel anytime.
              </Text>
            </VStack>
          )}

          {/* Plan cards — free users only */}
          {!isPro && (
            <LoadingWrapper
              isLoading={loadingOffering}
              skeleton={<SubscriptionPlanSkeleton />}
            >
              <VStack className="gap-y-2">
                <Text bold className="text-2xl">
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
                              ? "bg-primary-0 border border-primary-200"
                              : "bg-background-50 border border-background-50"
                          }`}
                        >
                          <HStack className="items-center justify-between">
                            <VStack className="gap-y-0.5 flex-1">
                              <HStack className="items-center gap-x-2">
                                <Text
                                  bold
                                  className={`text-lg ${isSelected ? "text-primary-500" : ""}`}
                                >
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
                                className={`text-xl ${isSelected ? "text-primary-500" : ""}`}
                              >
                                {priceLabel}
                                <Text
                                  className={`text-sm ${isSelected ? "text-primary-500" : "text-secondary-950"}`}
                                >
                                  {" "}
                                  {plan.fallbackSuffix}
                                </Text>
                              </Text>

                              {/* Radio button */}
                              <RadioButton selected={isSelected} />
                            </HStack>
                          </HStack>
                        </Box>
                      </Pressable>
                    );
                  })}
                </VStack>
              </VStack>
            </LoadingWrapper>
          )}

          {/* Feature list */}
          <VStack className="gap-y-2">
            <Text bold className="text-2xl">
              {isPro ? "Your Pro Features" : "What you get"}
            </Text>
            <Box className="rounded-2xl overflow-hidden bg-background-50">
              {PRO_FEATURES.map((feature, index) => (
                <Box key={feature.title}>
                  <HStack className="gap-x-3 items-start p-4">
                    <Box className="bg-primary-50 p-2 rounded-full mt-0.5">
                      <Icon as={feature.icon} className="text-primary-600" />
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
                  {index < PRO_FEATURES.length - 1 && <ListDivider />}
                </Box>
              ))}
            </Box>
          </VStack>
        </VStack>
      </ScrollView>
      <SafeAreaView edges={["bottom"]}>
        <Box className="p-4">
          {/* CTA — Pro users */}
          {isPro && (
            <FormButton
              text="Manage Subscription"
              variant="outline"
              loading={managingSubscription}
              onPress={handleManageSubscription}
            />
          )}

          {!isPro && (
            <FormButton
              text={ctaLabel()}
              loading={purchasing}
              disabled={purchasing || restoring || loadingOffering}
              onPress={handleSubscribe}
            />
          )}
        </Box>

        {!isPro && (
          <Text className="text-center text-secondary-950 text-sm leading-relaxed">
            Subscription renews automatically.{"\n"}
            Cancel anytime via App Store settings.
          </Text>
        )}
      </SafeAreaView>
    </InnerLayout>
  );
}
