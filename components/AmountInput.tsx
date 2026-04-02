import { TextInputProps } from "react-native";
import { Button } from "./ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "./ui/form-control";
import { Input, InputField, InputIcon, InputSlot } from "./ui/input";
import { Text } from "./ui/text";

interface IFormInputProps extends TextInputProps {
  label?: string;
  placeholder: string;
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

const AmountInput: React.FC<IFormInputProps> = ({
  label,
  placeholder,
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
      {label && (
        <FormControlLabel>
          <FormControlLabelText>{label}</FormControlLabelText>
        </FormControlLabel>
      )}
      <Input variant="underlined" className="h-[64]">
        <InputSlot className="mx-4 place-self-center">
          <Text bold className="text-4xl mt-1">
            ₱
          </Text>
        </InputSlot>

        <InputField
          className="text-4xl font-bold place-self-center"
          autoCapitalize="none"
          keyboardType="numeric"
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
    </FormControl>
  );
};

export default AmountInput;
