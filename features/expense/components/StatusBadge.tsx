import AppBadge from "@/components/AppBadge";

export default function StatusBadge({
  status,
  size = "sm"
}: {
  status: string;
  size?: "sm" | "md" | "lg";
}) {
  let action: "success" | "info" | "warning" = "warning";
  let text = status;

  if (status === "paid") {
    action = "success";
    text = "Paid";
  } else if (status === "requested") {
    action = "info";
    text = "Requested";
  } else if (status === "payer") {
    action = "success";
    text = "You are the payer";
  }

  return <AppBadge text={text} action={action} size={size} />;
}
