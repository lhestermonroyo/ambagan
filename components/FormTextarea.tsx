import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import React, { FC } from "react";
import { TextInputProps } from "react-native";

interface IFormTextareaProps extends TextInputProps {
  placeholder: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
  size?: "sm" | "md" | "lg";
}

const FormTextarea: FC<IFormTextareaProps> = ({
  placeholder,
  label,
  value,
  onChangeText,
  helperText,
  isRequired = false,
  isReadOnly = false,
  isDisabled = false,
  errorMessage,
  size = "md",
  ...props
}) => {
  const sizeClasses = {
    sm: "h-[80]",
    md: "h-[100]",
    lg: "h-[150]"
  };

  return (
    <FormControl
      size="md"
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      isInvalid={!!errorMessage}
    >
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>

      <Textarea
        className={cn("rounded-lg px-2 py-1", sizeClasses[size])}
        size="lg"
      >
        <TextareaInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
      </Textarea>

      {helperText && (
        <FormControlHelper>
          <FormControlHelperText className="text-gray-500">
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

export default FormTextarea;
