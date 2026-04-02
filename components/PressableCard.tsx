import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Card } from "./ui/card";
import { Pressable } from "./ui/pressable";

const PressableCard = ({
  children,
  onPress,
  className,
  disabled = false,
  ...props
}: {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  disabled?: boolean;
} & React.ComponentProps<typeof Card>) => {
  return (
    <Pressable onPress={onPress} disabled={disabled} className="flex-1">
      {({ pressed }) => (
        <Card
          className={cn(
            pressed ? "bg-background-50" : "bg-background-0",
            disabled && "opacity-50",
            className
          )}
          {...props}
        >
          {children}
        </Card>
      )}
    </Pressable>
  );
};

export default PressableCard;
