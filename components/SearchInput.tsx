import { useEffect, useState } from "react";
import { TextInputProps } from "react-native";
import Icon from "./Icon";
import { Button } from "./ui/button";
import { Input, InputField, InputIcon, InputSlot } from "./ui/input";

interface IFormInputProps extends TextInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSetSearching?: (searching: boolean) => void;
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
  onSetSearching,
  onPressRightIcon,
  rightIcon,
  helperText,
  isRequired = false,
  isReadOnly = false,
  isDisabled = false,
  errorMessage,
  ...props
}) => {
  const [searchValue, setSearchValue] = useState(value ?? "");

  useEffect(() => {
    if (value === "") {
      setSearchValue("");
    }
  }, [value]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSetSearching?.(searchValue.length > 0);
      onChangeText(searchValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  return (
    <Input variant="rounded" className="bg-background-50 border-0" size="lg">
      <InputSlot className="ml-2 mr-[-6]">
        <Icon as="search" />
      </InputSlot>

      <InputField
        autoCapitalize="none"
        placeholder={placeholder}
        value={searchValue}
        onChangeText={setSearchValue}
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

export default SearchInput;
