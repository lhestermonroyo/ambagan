import { Badge, BadgeText } from "@/components/ui/badge";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export default function AppBadge({
  text,
  icon,
  size = "sm",
  variant = "solid",
  action = "success",
  ...rest
}: {
  text: string;
  icon?: React.ReactNode;
} & React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      size={size}
      variant={variant}
      action={action}
      className="rounded-full"
      {...rest}
    >
      {icon}
      <BadgeText className={cn(icon ? "ml-1" : "")}>{text}</BadgeText>
    </Badge>
  );
}
