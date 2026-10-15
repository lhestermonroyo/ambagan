import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Box } from "./ui/box";
import { Pressable } from "./ui/pressable";

const PressableListItem = ({
  children,
  onPress,
  className,
  disabled = false,
  dimDisabled = true,
  surface = "default"
}: {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  disabled?: boolean;
  dimDisabled?: boolean;
  surface?: "default" | "muted";
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={disabled && !dimDisabled ? "data-[disabled=true]:opacity-100" : undefined}
    >
      {({ pressed, hovered }) => (
        <Box
          className={cn(
            className,
            surface === "muted"
              ? pressed || hovered
                ? "bg-secondary-200"
                : "bg-secondary-100"
              : pressed
                ? "bg-background-50"
                : "bg-background-0"
          )}
        >
          {children}
        </Box>
      )}
    </Pressable>
  );
};

export default PressableListItem;
