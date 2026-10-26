import { Badge, BadgeText } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  ChartPie,
  CheckCheck,
  CircleMinus,
  CircleX,
  Clock,
  FileCheckCorner,
  RefreshCcw
} from "lucide-react-native";

export default function StatusBadge({
  status,
  size = "sm",
  iconOnly = false
}: {
  // "partially_paid" describes row progress only; the stored settlement status
  // still controls request/review actions.
  status:
    | "settled"
    | "requested"
    | "pending"
    | "ongoing"
    | "completed"
    | "partially_paid"
    | "confirmed"
    | "rejected"
    | "withdrawn";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}) {
  let action: "success" | "info" | "muted" | "warning" | "error" = "warning";
  let text;
  let icon;
  const iconSize = iconOnly || size === "lg" ? "sm" : "2xs";

  if (status === "settled" || status === "confirmed") {
    action = "success";
    text = status === "confirmed" ? "Confirmed" : "Settled";
    icon = <Icon as={CheckCheck} size={iconSize} className="text-success-600 dark:text-success-800" />;
  } else if (status === "rejected") {
    action = "error";
    text = "Rejected";
    icon = <Icon as={CircleX} size={iconSize} className="text-error-600 dark:text-error-800" />;
  } else if (status === "withdrawn") {
    action = "muted";
    text = "Withdrawn";
    icon = <Icon as={CircleMinus} size={iconSize} className="text-secondary-950" />;
  } else if (status === "partially_paid") {
    text = "Partially Paid";
    icon = <Icon as={ChartPie} size={iconSize} className="text-primary-700 dark:text-primary-800" />;
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
    <Badge action={action} size={size} className={`rounded-full self-start shrink-0 ${status === "partially_paid" ? "bg-primary-50" : ""}`}>
      {icon}
      {/* Measure the displayed uppercase string, and keep the pill from being
          compressed by adjacent names/amounts on narrow settlement rows. */}
      <BadgeText className={`ml-1 shrink-0 normal-case ${status === "partially_paid" ? "text-primary-700 dark:text-primary-800" : ""}`}>
        {text.toUpperCase()}
      </BadgeText>
    </Badge>
  );
}
