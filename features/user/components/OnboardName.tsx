import FormInput from "@/components/FormInput";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
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
    <VStack className="gap-y-6 px-4 flex-1">
      <Text className="text-xl text-secondary-950">
        Let's start with your name. You can always change this later in your
        profile settings.
      </Text>
      <HStack className="gap-x-2">
        <VStack className="flex-1">
          <FormInput
            type="text"
            label="Firstname"
            placeholder="Juan"
            value={values.first_name}
            onChangeText={(text) => setValues({ ...values, first_name: text })}
            autoCapitalize="none"
          />
        </VStack>

        <VStack className="flex-1 justify-end">
          <FormInput
            type="text"
            label="Lastname"
            placeholder="Dela Cruz"
            value={values.last_name}
            onChangeText={(text) => setValues({ ...values, last_name: text })}
            autoCapitalize="none"
          />
        </VStack>
      </HStack>
    </VStack>
  );
};

export default OnboardName;
