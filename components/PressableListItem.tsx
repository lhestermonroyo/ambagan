import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Box } from "./ui/box";
import { Pressable } from "./ui/pressable";

const PressableListItem = ({
  children,
  onPress,
  className,
  disabled = false
}: {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <Box
          className={cn(
            pressed ? "bg-background-50" : "bg-background-0",
            disabled && "opacity-50",
            className
          )}
        >
          {children}
        </Box>
      )}
    </Pressable>
  );
};

export default PressableListItem;
