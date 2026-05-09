import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { Button, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadAvatar from "@/components/UploadAvatar";
import MemberItem from "@/features/group/components/MemberItem";
import MembersSelectionSheet from "@/features/group/components/MembersSelectionSheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { categories } from "@/utils/constants";
import { addRecentUsers } from "@/utils/recentUsers";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";
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
  const [tab, setTab] = useState<"members" | "admin">("members");
  const [members, setMembers] = useState<UserPreview[]>([]);
  const [admin, setAdmin] = useState<UserPreview[]>([]);

  const user = states.user();

  const router = useRouter();
  const toast = useAppToast();

  useEffect(() => {
    if (user.session && user.details) {
      setAdmin([
        {
          id: user.details.id,
          first_name: user.details.first_name,
          last_name: user.details.last_name,
          email: user.details.email,
          phone: user.details.phone,
          avatar: user.details.avatar
        }
      ]);
    }
  }, []);

  const handleSaveMembers = (selected: UserPreview[]) => {
    setMembers(selected);
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
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

    if (admin.length === 0) {
      toast({
        title: "No Admin Selected",
        description: "An admin is required to create a group.",
        type: "error"
      });
      return;
    }

    if (members.length === 0) {
      toast({
        title: "No Members Selected",
        description: "Please select at least one member to create a group.",
        type: "error"
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await services.group.saveGroup({
        name: values.name,
        avatar: values.avatar,
        category: values.category,
        admin_id: admin[0].id,
        member_ids: members.concat(admin).map((member) => member.id)
      });

      if (!response) {
        throw new Error("Failed to create group");
      }

      await addRecentUsers(members, user.details!.id);

      toast({
        title: "Group Created",
        description: "Group created successfully.",
        type: "success"
      });
      router.back();
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Group Creation Failed",
        description:
          "An error occurred while creating the group. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <FormLayout
        title="Create Group"
        onBack={() => router.back()}
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
        <ScrollView className="flex-1" bounces={false}>
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
            <FormControl size="md">
              <VStack className="gap-y-2">
                <HStack>
                  <FormControlLabel className="flex-1">
                    <FormControlLabelText>Members</FormControlLabelText>
                  </FormControlLabel>
                  <Button
                    variant="link"
                    onPress={() => setOpenSelectMembers(true)}
                  >
                    <Text className="text-primary-400 font-medium">
                      Add Member
                    </Text>
                  </Button>
                </HStack>
                <HStack className="gap-x-2">
                  <FormButton
                    text="Members"
                    size="md"
                    variant={tab === "members" ? "solid" : "outline"}
                    className="flex-1"
                    onPress={() => setTab("members")}
                  />
                  <FormButton
                    text="Admin"
                    size="md"
                    variant={tab === "admin" ? "solid" : "outline"}
                    className="flex-1"
                    onPress={() => setTab("admin")}
                  />
                </HStack>
                <FlatList
                  data={tab === "members" ? members : admin}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <MemberItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemoveMember(item.id)}
                    />
                  )}
                  ListEmptyComponent={() =>
                    tab === "members" ? (
                      <VStack className="p-4 justify-center items-center">
                        <Text className="text-secondary-950 text-center">
                          No members added yet. Click "Add Member" to include
                          members in your group.
                        </Text>
                      </VStack>
                    ) : (
                      <VStack className="p-4 justify-center items-center">
                        <Text className="text-secondary-950">
                          An admin is required to create a group.
                        </Text>
                      </VStack>
                    )
                  }
                  ItemSeparatorComponent={() => (
                    <Divider className="border-secondary-100" />
                  )}
                />
                <MembersSelectionSheet
                  isOpen={openSelectMembers}
                  onClose={() => setOpenSelectMembers(false)}
                  members={members}
                  onSaveMembers={handleSaveMembers}
                />
              </VStack>
            </FormControl>
          </VStack>
        </ScrollView>
      </FormLayout>
    </Fragment>
  );
}
