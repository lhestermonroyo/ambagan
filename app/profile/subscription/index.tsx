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
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import {
  CheckCircle,
  Crown,
  Globe,
  HousePlus,
  TrendingUp,
  Zap
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

const FALLBACK_PRICE = 499;

const FEATURES: { icon: React.ElementType; label: string; description: string }[] = [
  {
    icon: HousePlus,
    label: "Unlimited groups",
    description: "Create as many groups as you need — no cap, ever."
  },
  {
    icon: Globe,
    label: "Multi-currency expenses",
    description: "Track expenses in PHP, USD, JPY, SGD, and 10 more currencies."
  },
  {
    icon: TrendingUp,
    label: "Export settlements as CSV",
    description: "Download settlements by date range for your records."
  },
  {
    icon: Zap,
    label: "All future updates",
    description: "New features as they ship — included forever."
  }
];

export default function SubscriptionScreen() {
  const { details: userDetails } = states.user();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const isPro = userDetails?.plan === "pro";

  const lifetimePkg: PurchasesPackage | undefined = offering
    ? services.purchase.getLifetimePackage(offering)
    : undefined;

  const priceLabel = lifetimePkg
    ? `₱${Math.round(lifetimePkg.product.price).toLocaleString("en-PH")}`
    : `₱${FALLBACK_PRICE}`;

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

  const handleUpgrade = async () => {
    if (!lifetimePkg) {
      toast({
        title: "Product Unavailable",
        description: "Could not load the purchase product. Please try again later.",
        type: "error"
      });
      return;
    }

    setPurchasing(true);
    try {
      const customerInfo = await services.purchase.purchasePackage(lifetimePkg);
      const { plan } = await services.purchase.syncPlanToSupabase(customerInfo);

      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at: null }
          : prev.details
      }));

      toast({
        title: "Welcome to Pro!",
        description: "You've unlocked Ambagan Pro. Enjoy unlimited groups and all features.",
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

  return (
    <InnerLayout title="Subscription" onBack={() => router.back()}>
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4 pb-10">
          {/* Current plan card */}
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

              {isPro && (
                <>
                  <Divider className="border-warning-300" />
                  <Text className="text-warning-950">
                    Lifetime access — thank you for your support! 🎉
                  </Text>
                </>
              )}

              {!isPro && (
                <>
                  <Divider className="border-background-200" />
                  <Text className="text-secondary-950">
                    You can create up to 3 groups. Upgrade to Pro to unlock unlimited groups and the full app.
                  </Text>
                </>
              )}
            </VStack>
          </Box>

          {/* Price + upgrade prompt — only for free users */}
          {!isPro && (
            <VStack className="gap-y-2">
              <HStack className="items-center justify-between">
                <VStack className="gap-y-0.5">
                  <Text bold className="text-xl">
                    Unlock Ambagan Pro
                  </Text>
                  <Text className="text-secondary-950 text-sm">
                    One-time purchase · No subscription · No renewal
                  </Text>
                </VStack>
                {loadingOffering && (
                  <ActivityIndicator
                    size="small"
                    color={getPrimaryHex("text-primary-400", colorScheme)}
                  />
                )}
              </HStack>

              <Box className="rounded-2xl border border-primary-400 bg-primary-50 dark:bg-primary-950 p-4 items-center">
                <Text bold className="text-4xl text-primary-400">
                  {priceLabel}
                </Text>
                <Text className="text-secondary-950 text-sm mt-1">
                  one-time, yours forever
                </Text>
              </Box>
            </VStack>
          )}

          {/* Feature list */}
          <VStack className="gap-y-2">
            <Text bold className="text-xl">
              {isPro ? "Your Pro Features" : "What's included"}
            </Text>

            <Box className="bg-background-50 rounded-2xl overflow-hidden border border-background-200">
              <FlatList
                scrollEnabled={false}
                data={FEATURES}
                keyExtractor={(item) => item.label}
                renderItem={({ item }) => (
                  <FeatureRow item={item} colorScheme={colorScheme} />
                )}
                ItemSeparatorComponent={ListDivider}
              />
            </Box>
          </VStack>

          {/* CTA */}
          {!isPro && (
            <VStack className="gap-y-3">
              <FormButton
                text={`Unlock Pro — ${priceLabel}`}
                loading={purchasing}
                disabled={purchasing || restoring || loadingOffering}
                onPress={handleUpgrade}
              />
              <FormButton
                text="Restore Purchase"
                variant="outline"
                loading={restoring}
                disabled={purchasing || restoring}
                onPress={handleRestore}
              />
              <Text className="text-center text-secondary-950 text-sm leading-relaxed">
                In-app purchase via App Store / Play Store.{"\n"}Pay once, use
                forever — no recurring charges.
              </Text>
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}

function FeatureRow({
  item,
  colorScheme
}: {
  item: (typeof FEATURES)[number];
  colorScheme: "light" | "dark";
}) {
  const { icon: FeatureIcon, label, description } = item;

  return (
    <HStack className="p-4 items-start gap-x-3">
      <FeatureIcon
        size={18}
        color={getPrimaryHex("text-primary-400", colorScheme)}
        style={{ marginTop: 2 }}
      />
      <VStack className="flex-1 gap-y-0.5">
        <Text className="font-medium">{label}</Text>
        <Text className="text-sm text-secondary-950">{description}</Text>
      </VStack>
      <CheckCircle
        size={16}
        color={getPrimaryHex("text-primary-400", colorScheme)}
        style={{ marginTop: 3 }}
      />
    </HStack>
  );
}
