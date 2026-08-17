import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { FC } from "react";
import { Box } from "./ui/box";
import { Button, ButtonSpinner, ButtonText } from "./ui/button";
import { Text } from "./ui/text";

interface IFormButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "link";
  action?: "primary" | "secondary" | "positive" | "negative";
  text: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: any;
  iconEnd?: any;
}

const FormButton: FC<IFormButtonProps> = ({
  className,
  variant = "solid",
  action = "primary",
  size = "lg",
  text,
  loading,
  disabled,
  onPress,
  icon,
  iconEnd,
  ...props
}) => {
  return (
    <Button
      className={cn(
        "disabled:opacity-70 rounded-full",
        size === "lg" ? "h-12" : "",
        className
      )}
      size={size}
      variant={variant}
      action={action}
      disabled={loading || disabled}
      onPress={onPress}
      {...props}
    >
      {icon && <Box className="ml-[-4px]">{icon}</Box>}
      {variant === "link" ? (
        <Text className="text-primary-400 font-medium">{text}</Text>
      ) : (
        <ButtonText
          className={cn(
            action === "secondary" && "text-inherit dark:text-secondary-950"
          )}
        >
          {text}
        </ButtonText>
      )}
      {iconEnd && <Box className="mr-[-4px]">{iconEnd}</Box>}
      {loading && (
        <ButtonSpinner
          className={
            variant === "outline" ? "text-primary-400" : "text-background-0"
          }
        />
      )}
    </Button>
  );
};

export default FormButton;
