import AppBadge from "@/components/AppBadge";

export default function ProBadge({
  size = "sm"
}: {
  size?: "sm" | "md" | "lg";
}) {
  return <AppBadge text="PRO" action="warning" size={size} />;
}
