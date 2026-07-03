import { Badge, BadgeText } from "@/components/ui/badge";

export default function PlaceholderBadge() {
  return (
    <Badge
      size="sm"
      variant="outline"
      className="rounded-full px-2 self-start border-secondary-300"
    >
      <BadgeText className="text-xs text-secondary-950 normal-case">
        Not on Ambagan
      </BadgeText>
    </Badge>
  );
}
