import CategoryIcon from "@/components/CategoryIcon";
import { CurrencySelectionSheet } from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import SelectField from "@/components/SelectField";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadAvatar from "@/components/UploadAvatar";
import CategorySheet, {
  groupCategoryMeta
} from "@/features/expense/components/CategorySheet";
import MemberItem from "@/features/group/components/MemberItem";
import MembersSelectionSheet from "@/features/group/components/MembersSelectionSheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { GroupCategory } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { categories, currencies } from "@/utils/constants";
import { BASE_CURRENCY } from "@/utils/fx";
import * as offlineQueue from "@/utils/offlineQueue";
import { addRecentUsers } from "@/utils/recentUsers";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

export default function CreateGroupScreen() {
  const user = states.user();
  const isPro = user.details?.plan === "pro";

  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    category: GroupCategory.GENERAL as string,
    // Every group starts in the app's home currency. Pro users can change it
    // here; for free users the selection is locked, pinning them to PHP.
    currency: BASE_CURRENCY
  });
  const [formErrors, setFormErrors] = useState({
    name: ""
  }) as any;
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [openSelectMembers, setOpenSelectMembers] = useState(false);
  const [tab, setTab] = useState<"members" | "admin">("members");
  const [members, setMembers] = useState<UserPreview[]>([]);
  const [admin, setAdmin] = useState<UserPreview[]>([]);

  const currencyLabel = useMemo(
    () => currencies.find((c) => c.value === values.currency)?.label,
    [values.currency]
  );

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
          avatar: user.details.avatar,
          plan: user.details.plan
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
    // Category always has a value (defaults to General), so only name needs a
    // required check here.
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required"
    };
    setFormErrors(nextErrors);
    if (nextErrors.name) return;

    if (admin.length === 0) {
      toast({
        title: "No Admin Selected",
        description: "An admin is required to create a group.",
        type: "error"
      });
      return;
    }

    // Members are optional — a group can start with just the admin, then invite
    // people (or add phone contacts). Expenses stay gated on having 2+ members.

    // Offline → queue the group creation. The cover photo is skipped (no
    // image upload offline); it can be added once the group syncs.
    const online = await offlineQueue.isOnline();
    if (!online) {
      // Phone-contact members need the placeholder RPC to get a stable id, so
      // a group with unresolved contacts can't be queued offline.
      if (services.member.hasUnresolvedContacts(members)) {
        toast({
          title: "You're offline",
          description:
            "Adding phone contacts as members needs an internet connection. Remove them or reconnect to continue.",
          type: "error"
        });
        return;
      }
      const clientId = uuid();
      const memberPreviews = members.concat(admin);
      const optimistic = offlineQueue.buildOptimisticGroup({
        clientId,
        name: values.name,
        category: values.category,
        currency: values.currency,
        admin: admin[0],
        members: memberPreviews
      });

      await offlineQueue.queueCreateGroup(
        user.details!.id,
        {
          name: values.name,
          category: values.category,
          currency: values.currency,
          avatar: null,
          admin_id: admin[0].id,
          member_ids: memberPreviews.map((member) => member.id)
        },
        optimistic
      );

      await addRecentUsers(members, user.details!.id).catch(() => {});

      toast({
        title: "Saved offline",
        description:
          "Your group will be created automatically when you're back online. You can add a cover photo after it syncs.",
        type: "info"
      });
      router.replace("/groups");
      return;
    }

    setSubmitting(true);

    try {
      // Turn any picked phone contacts into real placeholder user ids first.
      const resolvedMembers =
        await services.member.resolveContactMembers(members);

      const response = await services.group.saveGroup({
        name: values.name,
        avatar: values.avatar,
        category: values.category,
        currency: values.currency,
        admin_id: admin[0].id,
        member_ids: resolvedMembers.concat(admin).map((member) => member.id)
      });

      if (!response) {
        throw new Error("Failed to create group");
      }

      // Placeholder ghosts are dropped inside addRecentUsers, so recent stays clean.
      await addRecentUsers(resolvedMembers, user.details!.id);

      toast({
        title: "Group Created",
        description: "Group created successfully.",
        type: "success"
      });
      router.replace(`/groups/${response.data.groupId}`);
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
            // Stays enabled even with fields missing — tapping runs validation
            // and surfaces the errors rather than silently doing nothing.
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1">
          <VStack className="gap-y-6 p-4">
            <UploadAvatar
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

            <FormControl size="md">
              <FormControlLabel>
                <FormControlLabelText>Currency</FormControlLabelText>
              </FormControlLabel>
              <SelectField
                onPress={() =>
                  isPro ? setCurrencySheetOpen(true) : setUpgradeOpen(true)
                }
              >
                <Text className="text-lg" numberOfLines={1}>
                  {isPro ? currencyLabel : `${currencyLabel} - Pro`}
                </Text>
              </SelectField>
              <FormControlHelper>
                <FormControlHelperText>
                  New expenses in this group default to this currency. You can
                  still change it per expense.
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            <FormControl size="md">
              <VStack className="gap-y-2">
                <HStack>
                  <FormControlLabel className="flex-1">
                    <FormControlLabelText>
                      Members (optional)
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Button
                    variant="link"
                    onPress={() => setOpenSelectMembers(true)}
                  >
                    <Text className="text-primary-400 font-medium">
                      Add Members
                    </Text>
                  </Button>
                </HStack>
                <HStack className="gap-x-2">
                  <FormButton
                    text="Members"
                    size="sm"
                    variant={tab === "members" ? "solid" : "outline"}
                    className="flex-1"
                    onPress={() => setTab("members")}
                  />
                  <FormButton
                    text="Admin"
                    size="sm"
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
                        <Text className="text-sm text-secondary-950 text-center">
                          No members added yet. Click "Add Member" to include
                          members in your group.
                        </Text>
                      </VStack>
                    ) : (
                      <VStack className="p-4 justify-center items-center">
                        <Text className="text-sm text-secondary-950">
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

      <CategorySheet
        isOpen={categorySheetOpen}
        category={values.category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={(value) => setValues({ ...values, category: value })}
        options={categories}
      />

      <CurrencySelectionSheet
        isOpen={currencySheetOpen}
        currency={values.currency}
        onClose={() => setCurrencySheetOpen(false)}
        onCurrencyChange={(value) => setValues({ ...values, currency: value })}
      />

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Multi-currency groups are a Pro feature. Upgrade to track a trip's spending in any currency."
      />
    </Fragment>
  );
}
