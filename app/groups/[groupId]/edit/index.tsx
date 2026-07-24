import CategoryIcon from "@/components/CategoryIcon";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
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
import states from "@/states";
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

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.replace("/groups");
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
      // Offline fallback: seed from the live groups list / detail so the group
      // can still be edited (and queued) without a connection.
      const state = states.group.getState();
      const fromState =
        state.details?.id === id
          ? state.details
          : state.list.find((g) => g.id === id);
      if (fromState) {
        setValues({
          name: fromState.name,
          avatar: null,
          category: fromState.category
        });
        setDefaultAvatar(fromState.avatar || null);
      } else {
        toast({
          title: "Failed to Load Group",
          description:
            "An error occurred while loading the group details. Please try again.",
          type: "error"
        });
      }
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
    // Validate every required field at once so each missing one lights up
    // together (name outline + message, category label + message) instead of
    // surfacing one at a time.
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required",
      category: values.category ? "" : "Category is required"
    };
    setFormErrors(nextErrors);
    if (nextErrors.name || nextErrors.category) return;

    if (!groupId) return;

    setSubmitting(true);

    try {
      const response = await services.group.updateGroup(groupId, {
        name: values.name,
        category: values.category,
        avatar: values.avatar
      });

      if (!response) {
        throw new Error("Failed to update group");
      }

      toast({
        title: "Group Updated",
        description: "Your group has been successfully updated.",
        type: "success"
      });
      handleBack();
    } catch (error) {
      console.error("Error updating group:", error);
      toast({
        title: "Group Update Failed",
        description:
          "An error occurred while updating the group. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    handleReset();
    router.back();
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
            // Stays enabled even with fields missing — tapping runs validation
            // and surfaces the errors rather than silently doing nothing.
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1">
          <LoadingWrapper
            isLoading={loading}
            text="Loading group details..."
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
                onChangeText={(text) => {
                  setValues({ ...values, name: text });
                  if (formErrors.name)
                    setFormErrors((prev: any) => ({ ...prev, name: "" }));
                }}
                autoCapitalize="none"
                errorMessage={formErrors.name}
              />

              <FormControl size="md" isInvalid={!!formErrors.category}>
                <FormControlLabel>
                  <FormControlLabelText>Category</FormControlLabelText>
                </FormControlLabel>
                <HStack className="gap-2 flex-wrap">
                  {categories.map((category) => (
                    <Button
                      key={category.value}
                      size="md"
                      variant={
                        values.category === category.value ? "solid" : "outline"
                      }
                      onPress={() => {
                        setValues({ ...values, category: category.value });
                        if (formErrors.category)
                          setFormErrors((prev: any) => ({
                            ...prev,
                            category: ""
                          }));
                      }}
                      className={`items-center gap-x-2 pl-1.5 pr-4 rounded-full ${
                        values.category === category.value
                          ? "border-primary-400"
                          : "border-background-200 bg-background-50 dark:bg-background-100"
                      }`}
                    >
                      <CategoryIcon
                        icon={category.icon}
                        size={16}
                        variant={
                          values.category === category.value
                            ? "onSolid"
                            : "default"
                        }
                      />
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
                {formErrors.category && (
                  <FormControlError>
                    <FormControlErrorText>
                      {formErrors.category}
                    </FormControlErrorText>
                  </FormControlError>
                )}
              </FormControl>
            </VStack>
          </LoadingWrapper>
        </ScrollView>
      </FormLayout>
    </Fragment>
  );
}
