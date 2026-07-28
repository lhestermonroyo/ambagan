import CategoryIcon from "@/components/CategoryIcon";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import LoadingWrapper from "@/components/LoadingWrapper";
import SelectField from "@/components/SelectField";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadAvatar from "@/components/UploadAvatar";
import CategorySheet, {
  groupCategoryMeta
} from "@/features/expense/components/CategorySheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { GroupCategory } from "@/types/groups";
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
    category: GroupCategory.GENERAL as string
  });
  const [formErrors, setFormErrors] = useState({
    name: ""
  }) as any;
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
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
      category: GroupCategory.GENERAL
    });
  };

  const handleSubmit = async () => {
    // Category always has a value (defaults to General), so only name needs a
    // required check here.
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required"
    };
    setFormErrors(nextErrors);
    if (nextErrors.name) return;

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

              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Category</FormControlLabelText>
                </FormControlLabel>
                <SelectField
                  onPress={() => setCategorySheetOpen(true)}
                  leading={
                    <CategoryIcon
                      icon={groupCategoryMeta(values.category).icon}
                    />
                  }
                >
                  <Text className="text-lg" numberOfLines={1}>
                    {groupCategoryMeta(values.category).label}
                  </Text>
                </SelectField>
              </FormControl>
            </VStack>
          </LoadingWrapper>
        </ScrollView>
      </FormLayout>

      <CategorySheet
        isOpen={categorySheetOpen}
        category={values.category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={(value) => setValues({ ...values, category: value })}
        options={categories}
      />
    </Fragment>
  );
}
