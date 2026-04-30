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

  if (status === "settled") {
    action = "success";
    text = "Settled";
    icon = <CheckCheck size={12} color="#2A7948" />;
  } else if (status === "requested") {
    action = "info";
    text = "Requested";
    icon = <CheckLine size={12} color="#0B8DCD" />;
  } else if (status === "pending") {
    action = "warning";
    text = "Pending";
    icon = <Hourglass size={12} color="#D76C1F" />;
  } else if (status === "ongoing") {
    action = "muted";
    text = "Ongoing";
    icon = <RefreshCcw size={16} color="#414040" />;
  } else if (status === "completed") {
    action = "success";
    text = "Completed";
    icon = <CheckCheck size={16} color="#2A7948" />;
  }

  if (!text) return null;

  return (
    <AppBadge
      className="self-start"
      text={text}
      action={action}
      size={size}
      icon={icon}
    />
  );
}
