import FormInput from "@/components/FormInput";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
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
    <VStack className="gap-y-6 px-4 flex-1">
      <Text className="text-xl text-secondary-950">
        Next, we'll need your phone number. This will be used for account
        recovery and important notifications.
      </Text>

      <VStack className="flex-1">
        <FormInput
          type="text"
          label="Phone Number"
          placeholder="9XX XXX XXXX"
          keyboardType="phone-pad"
          value={values.phone}
          onChangeText={(text) => setValues({ ...values, phone: text })}
          leftAddon="+63"
          autoCapitalize="none"
        />
      </VStack>
    </VStack>
  );
};

export default OnboardPhone;
