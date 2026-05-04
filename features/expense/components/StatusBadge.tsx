import AppBadge from "@/components/AppBadge";
import {
  CheckCheck,
  CheckLine,
  Hourglass,
  RefreshCcw
} from "lucide-react-native";

export default function StatusBadge({
  status,
  size = "sm"
}: {
  status: "settled" | "requested" | "pending" | "ongoing" | "completed";
  size?: "sm" | "md" | "lg";
}) {
  let action: "success" | "info" | "muted" | "warning" = "warning";
  let text;
  let icon;
  let iconSize = size === "sm" || size === "md" ? 12 : 16;

  if (status === "settled") {
    action = "success";
    text = "Settled";
    icon = <CheckCheck size={iconSize} color="#2A7948" />;
  } else if (status === "requested") {
    action = "info";
    text = "Requested";
    icon = <CheckLine size={iconSize} color="#0B8DCD" />;
  } else if (status === "pending") {
    action = "warning";
    text = "Pending";
    icon = <Hourglass size={iconSize} color="#D76C1F" />;
  } else if (status === "ongoing") {
    action = "warning";
    text = "Ongoing";
    icon = <RefreshCcw size={iconSize} color="#D76C1F" />;
  } else if (status === "completed") {
    action = "success";
    text = "Completed";
    icon = <CheckCheck size={iconSize} color="#2A7948" />;
  }

  if (!text) return null;

  return (
    <AppBadge
      className="self-start rounded-md"
      text={text}
      action={action}
      size={size}
      icon={icon}
    />
  );
}
