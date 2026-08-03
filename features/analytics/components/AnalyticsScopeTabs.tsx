import FormButton from "@/components/FormButton";
import { HStack } from "@/components/ui/hstack";
import { AnalyticsScope } from "@/features/analytics/hooks/useAnalytics";

const SCOPES: { value: AnalyticsScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "groups", label: "Groups" },
  { value: "personal", label: "Personal" }
];

/**
 * Which half of the app the figures cover. "All" is the point of the screen —
 * it's the only surface that adds group splits to personal books — but the two
 * halves answer different questions ("what do I owe people" vs "what did I
 * spend"), so each stays reachable on its own.
 *
 * Matches the You|Group toggle on the group Stats tab rather than introducing a
 * second segmented-control idiom.
 */
export default function AnalyticsScopeTabs({
  scope,
  onChange
}: {
  scope: AnalyticsScope;
  onChange: (scope: AnalyticsScope) => void;
}) {
  return (
    <HStack className="gap-x-2">
      {SCOPES.map((item) => (
        <FormButton
          key={item.value}
          size="sm"
          variant={scope === item.value ? "solid" : "outline"}
          text={item.label}
          onPress={() => onChange(item.value)}
        />
      ))}
    </HStack>
  );
}
