import React, { FC } from "react";
import { Box } from "./ui/box";
import { Button, ButtonSpinner, ButtonText } from "./ui/button";

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
      className={`disabled:opacity-70 rounded-full ${className}`}
      size={size}
      variant={variant}
      action={action}
      disabled={loading || disabled}
      onPress={onPress}
      {...props}
    >
      {icon && <Box className="ml-[-4px]">{icon}</Box>}
      <ButtonText>{text}</ButtonText>
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
