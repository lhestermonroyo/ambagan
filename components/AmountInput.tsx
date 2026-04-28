import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { TextInputProps } from "react-native";
import { Button } from "./ui/button";
import { Input, InputField, InputIcon, InputSlot } from "./ui/input";
import { Text } from "./ui/text";

interface IFormInputProps extends TextInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onPressRightIcon?: () => void;
  className?: string;
  leftAddon?: string;
  leftIcon?:
    | React.ElementType<any, keyof React.JSX.IntrinsicElements>
    | undefined;
  rightIcon?:
    | React.ElementType<any, keyof React.JSX.IntrinsicElements>
    | undefined;

  helperText?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
}

const AmountInput: React.FC<IFormInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  onPressRightIcon,
  className,
  leftAddon,
  leftIcon,
  rightIcon,
  helperText,
  isRequired = false,
  isReadOnly = false,
  isDisabled = false,
  errorMessage,
  ...props
}) => {
  return (
    <Input className={cn("rounded-lg", className)} size="lg">
      {leftAddon && (
        <InputSlot>
          <Text className="font-medium ml-2">{leftAddon}</Text>
        </InputSlot>
      )}
      <InputField
        keyboardType="numeric"
        autoCapitalize="none"
        type="text"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        {...props}
      />
      {rightIcon && (
        <InputSlot>
          <Button onPress={onPressRightIcon} variant="link" className="mr-4">
            <InputIcon as={rightIcon} className="text-primary-400" />
          </Button>
        </InputSlot>
      )}
    </Input>
  );
};

export default AmountInput;
