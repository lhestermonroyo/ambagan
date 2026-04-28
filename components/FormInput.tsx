import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { LucideIcon } from "lucide-react-native";
import React, { FC } from "react";
import { TextInputProps } from "react-native";
import { Text } from "./ui/text";

interface IFormInputProps extends TextInputProps {
  type?: "text" | "password" | undefined;
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onPressRightIcon?: () => void;
  leftAddon?: string;
  leftIcon?: LucideIcon | string;
  rightIcon?:
    | React.ElementType<any, keyof React.JSX.IntrinsicElements>
    | undefined;

  helperText?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
}

const FormInput: FC<IFormInputProps> = ({
  type = "text",
  label,
  placeholder,
  value,
  onChangeText,
  onPressRightIcon,
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
    <FormControl
      size="md"
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      isInvalid={!!errorMessage}
    >
      {label && (
        <FormControlLabel>
          <FormControlLabelText>{label}</FormControlLabelText>
        </FormControlLabel>
      )}
      <Input className="rounded-lg" size="lg">
        {leftAddon && (
          <InputSlot>
            <Text className="font-medium ml-2">{leftAddon}</Text>
          </InputSlot>
        )}
        <InputField
          autoCapitalize="none"
          type={type}
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

      {helperText && (
        <FormControlHelper>
          <FormControlHelperText className="text-secondary-950">
            {helperText}
          </FormControlHelperText>
        </FormControlHelper>
      )}

      {errorMessage && (
        <FormControlError>
          <FormControlErrorText>{errorMessage}</FormControlErrorText>
        </FormControlError>
      )}
    </FormControl>
  );
};

export default FormInput;
