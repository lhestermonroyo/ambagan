import { Search } from 'lucide-react-native';
import { TextInputProps } from 'react-native';
import Icon from './Icon';
import { Button } from './ui/button';
import { Input, InputField, InputIcon, InputSlot } from './ui/input';

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

const SearchInput: React.FC<IFormInputProps> = ({
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
    <Input variant="rounded" className="bg-secondary-100 border-0" size="xl">
      <InputSlot className="ml-2">
        <Icon as={Search} className="text-secondary-950" />
      </InputSlot>

      <InputField
        autoCapitalize="none"
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
  );
};

export default SearchInput;
