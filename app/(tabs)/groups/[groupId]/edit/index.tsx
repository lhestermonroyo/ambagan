import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import LoadingWrapper from "@/components/LoadingWrapper";
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
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import { categories } from "@/utils/constants";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";

export default function EditGroupScreen() {
  const [loading, setLoading] = useState(false);
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
  const [defaultAvatar, setDefaultAvatar] = useState<string | null>(null);

  const params = useLocalSearchParams();
  const router = useRouter();
  const groupId = params.groupId as string | undefined;
  const isGroup = params.isGroup === "true";

  const showToast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.push("/groups");
          return;
        }

        fetchGroupDetails(groupId as string);
      },
      [groupId]
    )
  );

  const fetchGroupDetails = async (id: string) => {
    setLoading(true);

    try {
      const response = await services.group.getGroupById(id);

      if (!response) return;

      setValues({
        name: response.name,
        avatar: null,
        category: response.category
      });
      setDefaultAvatar(response.avatar || null);
    } catch (error) {
      console.error("Error fetching group details:", error);
      showToast(
        "Failed to Load Group",
        "An error occurred while loading the group details. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setValues({
      name: "",
      avatar: null,
      category: ""
    });
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

    setSubmitting(true);

    try {
      const response = await services.group.updateGroup(groupId as string, {
        name: values.name,
        category: values.category,
        avatar: values.avatar
      });

      if (!response) {
        throw new Error("Failed to update group");
      }

      showToast(
        "Group Updated",
        "Your group has been successfully updated.",
        "success"
      );
      handleBack();
    } catch (error) {
      console.error("Error updating group:", error);
      showToast(
        "Group Update Failed",
        "An error occurred while updating the group. Please try again.",
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
      router.push(`/groups/${groupId}`);
    }
  };

  return (
    <Fragment>
      <FormLayout
        title="Edit Group"
        onBack={handleBack}
        footer={[
          <FormButton
            className="flex-1"
            text="Save Changes"
            loading={submitting}
            disabled={!values.name || !values.category}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1" bounces={false}>
          <LoadingWrapper
            isLoading={loading}
            text="Loading group details, please wait..."
          >
            <VStack className="gap-y-6 p-4">
              <UploadAvatar
                defaultAvatar={defaultAvatar || undefined}
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
                          ? "border-primary-400"
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
            </VStack>
          </LoadingWrapper>
        </ScrollView>
      </FormLayout>
    </Fragment>
  );
}
