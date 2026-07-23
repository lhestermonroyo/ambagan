import { Box } from "@/components/ui/box";
import { getErrorHex, getSuccessHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";
import { useColorScheme } from "react-native";

// Circular icon badge sized to match CategoryIcon (`p-1.5 rounded-full`,
// icon size 18) so settlement rows and category rows share one avatar size.
export default function SettlementAvatar({
  isPayer,
  light = false
}: {
  isPayer: boolean;
  light?: boolean;
}) {
  const colorScheme = useColorScheme() ?? "light";

  if (light) {
    return (
      <Box className="bg-white/20 p-1.5 rounded-full">
        {isPayer ? (
          <BanknoteArrowUp size={18} color="#fff" />
        ) : (
          <BanknoteArrowDown size={18} color="#fff" />
        )}
      </Box>
    );
  }

  return (
    <Box
      className={cn(
        "p-1.5 rounded-full",
        isPayer ? "bg-success-50" : "bg-error-50"
      )}
    >
      {isPayer ? (
        <BanknoteArrowUp
          size={18}
          color={getSuccessHex("text-success-600", colorScheme)}
        />
      ) : (
        <BanknoteArrowDown
          size={18}
          color={getErrorHex("text-error-600", colorScheme)}
        />
      )}
    </Box>
  );
}
