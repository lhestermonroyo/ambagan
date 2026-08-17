import { Badge, BadgeText } from "@/components/ui/badge";

/**
 * Compact "N / limit LEFT" pill shown in the header of the free-tier expense
 * forms (group + personal). Turns red once the daily creation limit is hit.
 */
export default function DailyLimitBadge({
  count,
  limit
}: {
  count: number;
  limit: number;
}) {
  const remaining = limit - count;
  const isLimitReached = remaining <= 0;

  return (
    <Badge
      size="md"
      variant="solid"
      className={`rounded-full px-4 py-2 ${
        isLimitReached ? "bg-error-50" : "bg-primary-50"
      }`}
    >
      <BadgeText
        className={`font-bold text-sm uppercase ${
          isLimitReached ? "text-error-600" : "text-primary-400"
        }`}
      >
        {isLimitReached ? "LIMIT REACHED" : `${remaining} / ${limit} LEFT`}
      </BadgeText>
    </Badge>
  );
}
