import AppBadge from "@/components/AppBadge";
import { Icon } from "@/components/ui/icon";
import {
  CheckCheck,
  Clock,
  FileCheckCorner,
  RefreshCcw
} from "lucide-react-native";

export default function StatusBadge({
  status,
  size = "sm",
  iconOnly = false
}: {
  status: "settled" | "requested" | "pending" | "ongoing" | "completed";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}) {
  let action: "success" | "info" | "muted" | "warning" = "warning";
  let text;
  let icon;
  const iconSize = iconOnly || size === "lg" ? "sm" : "2xs";

  if (status === "settled") {
    action = "success";
    text = "Settled";
    icon = <Icon as={CheckCheck} size={iconSize} className="text-success-600 dark:text-success-800" />;
  } else if (status === "requested") {
    action = "info";
    text = "Requested";
    icon = <Icon as={FileCheckCorner} size={iconSize} className="text-info-600 dark:text-info-800" />;
  } else if (status === "pending") {
    action = "warning";
    text = "Pending";
    icon = <Icon as={Clock} size={iconSize} className="text-warning-600 dark:text-warning-800" />;
  } else if (status === "ongoing") {
    action = "warning";
    text = "Ongoing";
    icon = <Icon as={RefreshCcw} size={iconSize} className="text-warning-600 dark:text-warning-800" />;
  } else if (status === "completed") {
    action = "success";
    text = "Completed";
    icon = <Icon as={CheckCheck} size={iconSize} className="text-success-600 dark:text-success-800" />;
  }

  if (!text) return null;

  // Compact settlement rows show the status as a bare glyph (no pill/label).
  if (iconOnly) return icon ?? null;

  return (
    <AppBadge
      className="rounded-full"
      text={text}
      action={action}
      size={size}
      icon={icon}
    />
  );
}
