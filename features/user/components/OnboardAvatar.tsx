import UploadAvatar from "@/components/UploadAvatar";
import { VStack } from "@/components/ui/vstack";
import { ImagePickerSuccessResult } from "expo-image-picker";
import React from "react";

const OnboardAvatar = ({
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
    <VStack className="gap-y-6 items-center">
      <UploadAvatar
        type="onboarding"
        onSelect={(result) => setValues({ ...values, avatar: result })}
      />
    </VStack>
  );
};

export default OnboardAvatar;
