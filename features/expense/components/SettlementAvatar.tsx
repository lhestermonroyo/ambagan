import { Avatar } from "@/components/ui/avatar";
import { getErrorHex, getSuccessHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";
import { useColorScheme } from "react-native";

export default function SettlementAvatar({ isPayer }: { isPayer: boolean }) {
  const colorSheme = useColorScheme() ?? "light";

  return (
    <Avatar
      size="sm"
      className={cn(
        isPayer
          ? "bg-success-100 border border-success-200"
          : "bg-error-100 border border-error-200"
      )}
    >
      {isPayer ? (
        <BanknoteArrowUp
          size={16}
          color={getSuccessHex("text-success-600", colorSheme)}
        />
      ) : (
        <BanknoteArrowDown
          size={16}
          color={getErrorHex("text-error-600", colorSheme)}
        />
      )}
    </Avatar>
  );
}
