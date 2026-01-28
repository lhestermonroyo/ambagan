import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from '@/components/ui/form-control';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import React, { FC } from 'react';
import { TextInputProps } from 'react-native';

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

      <Textarea className="bg-white rounded-3xl px-2 py-1 h-[120]" size="xl">
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
