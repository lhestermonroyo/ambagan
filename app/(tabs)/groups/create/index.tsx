import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { VStack } from "@/components/ui/vstack";
import UploadAvatar from "@/components/UploadAvatar";
import MembersSelection from "@/features/group/components/MembersSelection";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { User } from "@/types/user";
import { categories } from "@/utils/constants";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useState } from "react";

export default function CreateGroupScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    category: ""
  });
  const [formErrors, setFormErrors] = useState({
    name: "",
    category: ""
  }) as any;
  const [openSelectMembers, setOpenSelectMembers] = useState(false);
  const [members, setMembers] = useState<User[]>([]);

  const user = states.user.getState();

  const params = useLocalSearchParams();
  const router = useRouter();
  const showToast = useAppToast();

  const isGroup = params.isGroup === "true";

  useEffect(() => {
    if (user.session && user.details) {
      setMembers([user.details]);
    }

    return () => {
      setMembers([]);
    };
  }, []);

  const handleReset = () => {
    setValues({
      name: "",
      avatar: null,
      category: ""
    });
    setMembers(user.details ? [user.details] : []);
  };

  const handleSaveMembers = (selectedMembers: User[]) => {
    setMembers(selectedMembers);
  };

  const handleSubmit = async () => {
    if (!values.name) {
      setFormErrors((prev: any) => ({ ...prev, name: "Name is required" }));
      return;
    }
    if (!values.category) {
      setFormErrors((prev: any) => ({
        ...prev,
        category: "Category is required"
      }));
      return;
    }

    if (members.length === 0) {
      showToast(
        "No Members Selected",
        "Please select at least one member to create a group.",
        "error"
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await services.group.saveGroup({
        name: values.name,
        avatar: values.avatar,
        category: values.category,
        members: members.map((member) => member.id)
      });

      if (response) {
        showToast(
          "Group Created",
          "Your group has been successfully created.",
          "success"
        );
        handleBack();
      }
    } catch (error) {
      console.error("Error creating group:", error);
      showToast(
        "Group Creation Failed",
        "An error occurred while creating the group. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    handleReset();

    if (isGroup) {
      router.push("/groups");
    } else {
      router.push("/home");
    }
  };

  return (
    <Fragment>
      <FormLayout
        title="Create Group"
        onBack={handleBack}
        footer={[
          <FormButton
            className="flex-1"
            text="Create"
            loading={submitting}
            disabled={!values.name || !values.category || members.length === 0}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <VStack className="gap-y-6 p-4">
            <UploadAvatar
              onSelect={(result) => setValues({ ...values, avatar: result })}
            />

            <FormInput
              type="text"
              label="Group Name"
              placeholder="Enter group name (e.g. Japan 2026)"
              value={values.name}
              onChangeText={(text) => setValues({ ...values, name: text })}
              autoCapitalize="none"
              errorMessage={formErrors.name}
            />

            <FormControl size="md">
              <FormControlLabel>
                <FormControlLabelText>Pick Category</FormControlLabelText>
              </FormControlLabel>
              <HStack className="gap-2 flex-wrap">
                {categories.map((category) => (
                  <Button
                    key={category.value}
                    size="md"
                    variant={
                      values.category === category.value ? "solid" : "outline"
                    }
                    onPress={() =>
                      setValues({ ...values, category: category.value })
                    }
                    className={`items-center px-4 rounded-full ${
                      values.category === category.value
                        ? "border-primary-500"
                        : "border-background-200 bg-background-50 dark:bg-background-100"
                    }`}
                  >
                    <ButtonText
                      className={
                        values.category === category.value
                          ? "text-background-0"
                          : "text-inherit"
                      }
                    >
                      {category.label}
                    </ButtonText>
                  </Button>
                ))}
              </HStack>
            </FormControl>
            <FormControl size="md">
              <HStack>
                <FormControlLabel className="flex-1">
                  <FormControlLabelText>Members</FormControlLabelText>
                </FormControlLabel>
                <FormButton
                  size="md"
                  text="Add Members"
                  variant="link"
                  onPress={() => setOpenSelectMembers(true)}
                />
              </HStack>
              <MembersSelection
                onSaveMembers={handleSaveMembers}
                isOpen={openSelectMembers}
                onClose={() => setOpenSelectMembers(false)}
              />
            </FormControl>
          </VStack>
        </ScrollView>
      </FormLayout>
    </Fragment>
  );
}
