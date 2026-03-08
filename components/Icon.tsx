import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "./ui/text";

export default function Icon({
  as,
  size,
  className
}: {
  as: React.ComponentProps<typeof MaterialIcons>["name"];
  size?: number;
  className?: string;
}) {
  return (
    <Text className={className} style={{ lineHeight: 0 }}>
      <MaterialIcons name={as} size={size || 24} />
    </Text>
  );
}
