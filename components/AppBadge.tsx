import { Badge, BadgeText } from "@/components/ui/badge";
import { MaterialIcons } from "@expo/vector-icons";
import Icon from "./Icon";

export default function AppBadge({
  text,
  icon,
  size = "sm",
  variant = "solid",
  action = "success",
  ...rest
}: {
  text: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
} & React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      size={size}
      variant={variant}
      action={action}
      className="rounded-full"
      {...rest}
    >
      <BadgeText>{text}</BadgeText>
      {icon && <Icon as={icon} size={14} className="text-secondary-950 ml-1" />}
    </Badge>
  );
}
