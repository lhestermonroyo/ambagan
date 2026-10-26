import FormInput from "@/components/FormInput";
import { VStack } from "@/components/ui/vstack";
import { ImagePickerSuccessResult } from "expo-image-picker";
import React from "react";

const OnboardName = ({
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
        label="First Name"
        placeholder="Juan"
        value={values.first_name}
        onChangeText={(text) => setValues({ ...values, first_name: text })}
        autoCapitalize="none"
      />
      <FormInput
        type="text"
        label="Last Name"
        placeholder="Dela Cruz"
        value={values.last_name}
        onChangeText={(text) => setValues({ ...values, last_name: text })}
        autoCapitalize="none"
      />
    </VStack>
  );
};

export default OnboardName;
