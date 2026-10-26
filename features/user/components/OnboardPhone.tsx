import FormInput from "@/components/FormInput";
import { VStack } from "@/components/ui/vstack";
import { formatPhoneInput, parsePhoneInput } from "@/utils/formatPhone";
import { ImagePickerSuccessResult } from "expo-image-picker";
import React from "react";

const OnboardPhone = ({
  values,
  setValues
}: {
  values: {
    first_name: string;
    last_name: string;
    phone: string;
    avatar: ImagePickerSuccessResult | null;
  };
  setValues: React.Dispatch<
    React.SetStateAction<{
      first_name: string;
      last_name: string;
      phone: string;
      avatar: ImagePickerSuccessResult | null;
    }>
  >;
}) => {
  return (
    <VStack className="gap-y-6">
      <FormInput
        type="text"
        label="Phone Number"
        placeholder="9XX XXX XXXX"
        keyboardType="phone-pad"
        value={formatPhoneInput(values.phone)}
        onChangeText={(text) =>
          setValues({ ...values, phone: parsePhoneInput(text) })
        }
        leftAddon="+63"
        autoCapitalize="none"
      />
    </VStack>
  );
};

export default OnboardPhone;
