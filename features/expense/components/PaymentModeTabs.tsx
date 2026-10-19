import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";

export type PaymentMode = "full" | "partial";

export default function PaymentModeTabs({ value, onChange, disabled = false }: {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}) {
  return (
    <HStack className="gap-x-2">
      {([
        { value: "full", label: "Pay in Full" },
        { value: "partial", label: "Pay Partially" }
      ] as const).map(mode => (
        <Button
          key={mode.value}
          className="flex-1 rounded-full h-11"
          variant={value === mode.value ? "solid" : "outline"}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === mode.value }}
          disabled={disabled}
          onPress={() => onChange(mode.value)}
        >
          <ButtonText>{mode.label}</ButtonText>
        </Button>
      ))}
    </HStack>
  );
}
