import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import React, { FC } from 'react';
import { TextInputProps } from 'react-native';

interface IFormInputProps extends TextInputProps {
  type: 'text' | 'password' | undefined;
  placeholder: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onPressRightIcon?: () => void;
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
  type,
  placeholder,
  label,
  value,
  onChangeText,
  onPressRightIcon,
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
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>

      <Input variant="rounded" className="bg-white" size="xl">
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
              <InputIcon as={rightIcon} className="text-primary-500" />
            </Button>
          </InputSlot>
        )}
      </Input>

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

export default FormInput;
