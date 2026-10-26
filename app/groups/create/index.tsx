import CategoryIcon from "@/components/CategoryIcon";
import ConfirmationSheet from "@/components/ConfirmationSheet";
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
import GroupMemberRow from "@/features/group/components/GroupMemberRow";
import MemberActionsSheet from "@/features/group/components/MemberActionsSheet";
import MembersSelectionSheet from "@/features/group/components/MembersSelectionSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { GroupCategory, GroupMode, GroupRole, Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { categories, currencies } from "@/utils/constants";
import { BASE_CURRENCY } from "@/utils/fx";
import { getPrimaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { addRecentUsers } from "@/utils/recentUsers";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Info, NotebookPen } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

export default function CreateGroupScreen() {
  const user = states.user();
  const isPro = user.details?.plan === "pro";
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<GroupMode>(
    params.mode === GroupMode.INDIVIDUAL ? GroupMode.INDIVIDUAL : GroupMode.GROUP
  );
  const individual = mode === GroupMode.INDIVIDUAL;

  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    category: GroupCategory.GENERAL as string,
    // The group's REPORTING currency — what the stats tab, member breakdown and
    // To Collect / To Pay totals convert into. Every group starts in the app's
    // home currency. Pro users can change it here; for free users the selection
    // is locked, pinning them to PHP.
    currency: BASE_CURRENCY
  });
  const [formErrors, setFormErrors] = useState({
    name: ""
  }) as any;
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [openSelectMembers, setOpenSelectMembers] = useState(false);
  const [members, setMembers] = useState<UserPreview[]>([]);
  const [adminMemberIds, setAdminMemberIds] = useState<Set<string>>(new Set());
  const [actionMember, setActionMember] = useState<Member | null>(null);
  const [individualConfirmOpen, setIndividualConfirmOpen] = useState(false);
  const owner = user.details;
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  const roster = useMemo(() => {
    const ordered = [
      ...(owner ? [owner] : []),
      ...members.filter((member) => adminMemberIds.has(member.id)),
      ...members.filter((member) => !adminMemberIds.has(member.id))
    ];
    return ordered.map((member): Member => ({
      ...member,
      group_id: "",
      joined_at: "",
      role: member.id === owner?.id || adminMemberIds.has(member.id)
        ? GroupRole.ADMIN
        : GroupRole.MEMBER
    }));
  }, [owner, members, adminMemberIds]);

  const currencyLabel = useMemo(
    () => currencies.find((c) => c.value === values.currency)?.label,
    [values.currency]
  );

  const router = useRouter();
  const toast = useAppToast();
  const showFeedback = useActionFeedback();

  const switchToIndividual = () => {
    if (submitting) return;
    setMembers([]);
    setAdminMemberIds(new Set());
    setOpenSelectMembers(false);
    setActionMember(null);
    setIndividualConfirmOpen(false);
    setMode(GroupMode.INDIVIDUAL);
  };

  const requestIndividualMode = () => {
    if (individual || submitting) return;
    if (members.length > 0) {
      setIndividualConfirmOpen(true);
      return;
    }
    switchToIndividual();
  };

  const handleSaveMembers = (selected: UserPreview[]) => {
    const nextMembers = [...new Map(
      selected.filter((member) => member.id !== owner?.id)
        .map((member) => [member.id, member] as const)
    ).values()];
    setMembers(nextMembers);
    const selectedIds = new Set(nextMembers.map((member) => member.id));
    setAdminMemberIds((prev) => new Set([...prev].filter((id) => selectedIds.has(id))));
  };

  const handleRemoveMember = (member: Member) => {
    if (member.id === owner?.id || submitting) return;
    setActionMember(null);
    setMembers((prev) => prev.filter((item) => item.id !== member.id));
    setAdminMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
  };

  const handleSetRole = (member: Member, role: GroupRole) => {
    if (
      member.id === owner?.id || submitting ||
      !members.some((item) => item.id === member.id)
    ) return;
    setActionMember(null);
    setAdminMemberIds((prev) => {
      const next = new Set(prev);
      if (role === GroupRole.ADMIN) next.add(member.id);
      else next.delete(member.id);
      return next;
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

    // New expenses follow the reporting currency. A separate default can be
    // configured later in Edit Group or Edit Individual.
    if (individual) {
      if (!user.details?.id || submitting) return;
      setSubmitting(true);
      const args = {
        name: values.name.trim(), category: values.category,
        currency: values.currency, default_expense_currency: null,
        budget: null,
        budget_period: "monthly" as const, user_id: user.details.id,
        group_id: null, avatar: values.avatar
      };
      try {
        if (!(await offlineQueue.isOnline())) {
          const clientId = uuid();
          const optimistic = offlineQueue.buildOptimisticBook({
            clientId, name: args.name, category: args.category, currency: args.currency,
            defaultExpenseCurrency: null, budget: args.budget, budgetPeriod: args.budget_period,
            groupId: null, userId: user.details.id
          });
          await offlineQueue.queueCreateBook(user.details.id, { ...args, avatar: null }, optimistic);
          toast({ title: "Saved Offline", description: "Your Individual entry will sync when you're back online. You can add a cover photo after it syncs.", type: "info", haptic: true });
          router.replace("/groups");
        } else {
          const response = await services.book.saveBook(args);
          const shown = await showFeedback("individual-created", {
            once: true,
            afterNavigation: true
          });
          if (!shown) toast({ title: "Individual Created", description: "Your expenses are private to you.", type: "success" });
          router.replace(`/books/${response.data.bookId}`);
        }
      } catch (error) {
        console.error("Error creating Individual entry:", error);
        toast({ title: "Creation Failed", description: "Couldn't create the Individual entry. Please try again.", type: "error" });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!owner?.id || submitting) return;

    // Members are optional — a group can start with just the owner, then invite
    // people (or add phone contacts). Expenses stay gated on having 2+ members.

    setSubmitting(true);

    try {
      // Offline → queue the group creation. The cover photo is skipped (no
      // image upload offline); it can be added once the group syncs.
      const online = await offlineQueue.isOnline();
      if (!online) {
        // Phone-contact members need the placeholder RPC to get a stable id, so
        // a group with unresolved contacts can't be queued offline.
        if (services.member.hasUnresolvedContacts(members)) {
          toast({
            title: "You're Offline",
            description:
              "Adding phone contacts as members needs an internet connection. Remove them or reconnect to continue.",
            type: "error"
          });
          return;
        }
        const clientId = uuid();
        const memberPreviews = [owner, ...members];
        const optimistic = offlineQueue.buildOptimisticGroup({
          clientId,
          name: values.name,
          category: values.category,
          currency: values.currency,
          default_expense_currency: null,
          admin: owner,
          members: memberPreviews,
          admin_member_ids: [...adminMemberIds]
        });

        await offlineQueue.queueCreateGroup(
          user.details!.id,
          {
            name: values.name,
            category: values.category,
            currency: values.currency,
            default_expense_currency: null,
            avatar: null,
            admin_id: owner.id,
            member_ids: memberPreviews.map((member) => member.id),
            admin_member_ids: [...adminMemberIds]
          },
          optimistic
        );

        await addRecentUsers(members, user.details!.id).catch(() => {});

        toast({
          title: "Saved Offline",
          description:
            "Your group will be created automatically when you're back online. You can add a cover photo after it syncs.",
          type: "info",
          haptic: true
        });
        router.replace("/groups");
        return;
      }

      // Turn any picked phone contacts into real placeholder user ids first.
      const resolvedMembers =
        await services.member.resolveContactMembers(members);

      const response = await services.group.saveGroup({
        name: values.name,
        avatar: values.avatar,
        category: values.category,
        currency: values.currency,
        default_expense_currency: null,
        admin_id: owner.id,
        member_ids: [owner.id, ...resolvedMembers.map((member) => member.id)],
        // Contact resolution preserves order but can replace a temporary ID.
        admin_member_ids: resolvedMembers
          .filter((_, index) => adminMemberIds.has(members[index].id))
          .map((member) => member.id)
      });

      if (!response) {
        throw new Error("Failed to create group");
      }

      // Placeholder ghosts are dropped inside addRecentUsers, so recent stays clean.
      await addRecentUsers(resolvedMembers, user.details!.id);

      await showFeedback("group-created", { afterNavigation: true });
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
              label="Name"
              placeholder="Enter name (e.g. Daily, Japan Trip)"
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

            {/* The group's REPORTING currency. Kept alongside name and
                category rather than tucked away: it's what every figure on the
                group is denominated in, so it's part of what the group IS
                rather than a setting on it. */}
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
                  {individual ? "Totals and stats convert to it." : "Totals, stats and balances convert to it."}
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            <FormControl size="md">
              <FormControlLabel><FormControlLabelText>Mode</FormControlLabelText></FormControlLabel>
              <VStack className="gap-y-4">
                <HStack className="gap-x-2">
                  <FormButton text="Group" size="sm" className="flex-1"
                    variant={individual ? "outline" : "solid"}
                    disabled={submitting}
                    onPress={() => setMode(GroupMode.GROUP)} />
                  <FormButton text="Individual" size="sm" className="flex-1"
                    variant={individual ? "solid" : "outline"}
                    disabled={submitting}
                    onPress={requestIndividualMode} />
                </HStack>
                <VStack className="p-4 bg-primary-50 rounded-xl">
                  <HStack className="gap-x-2 items-start">
                    <Info
                      size={20}
                      color={getPrimaryHex(
                        colorScheme === "dark" ? "text-primary-800" : "text-primary-500",
                        colorScheme
                      )}
                    />
                    <Text className="flex-1 text-primary-500 dark:text-primary-800">
                      {individual
                        ? "Track your own expenses. Only you can access this entry."
                        : "Split expenses and settle up with other people."}
                    </Text>
                  </HStack>
                </VStack>
              </VStack>
            </FormControl>

            {!individual && <FormControl size="md">
              <VStack className="gap-y-2">
                <HStack>
                  <FormControlLabel className="flex-1">
                    <FormControlLabelText>
                      Members (Optional)
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Button
                    variant="link"
                    disabled={submitting}
                    onPress={() => setOpenSelectMembers(true)}
                  >
                    <Text className="text-primary-400 font-medium">
                      Add Members
                    </Text>
                  </Button>
                </HStack>
                <FlatList
                  data={roster}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <GroupMemberRow
                      item={item}
                      ownerId={owner?.id ?? ""}
                      pending={submitting && item.id !== owner?.id}
                      colorScheme={colorScheme}
                      canManage
                      onOpenActions={setActionMember}
                      onSetRole={handleSetRole}
                      onRemove={handleRemoveMember}
                    />
                  )}
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
            </FormControl>}
          </VStack>
        </ScrollView>
      </FormLayout>

      <ConfirmationSheet
        isOpen={individualConfirmOpen}
        icon={NotebookPen}
        onClose={() => setIndividualConfirmOpen(false)}
        title="Switch to Individual?"
        description={
          `Individual entries are private to you. Switching will clear your ${members.length} selected ${members.length === 1 ? "member" : "members"} and any admin assignments from this form.`
        }
        confirmText="Switch to Individual"
        cancelText="Keep Group"
        onConfirm={switchToIndividual}
      />

      {Platform.OS !== "ios" && (
        <MemberActionsSheet
          isOpen={!!actionMember && !individual}
          onClose={() => setActionMember(null)}
          member={actionMember}
          canManage
          isOwnerRow={actionMember?.id === owner?.id}
          onSetRole={handleSetRole}
          onRemove={handleRemoveMember}
        />
      )}

      <CategorySheet
        isOpen={categorySheetOpen}
        category={values.category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={(value) => setValues({ ...values, category: value })}
        options={categories}
      />

      <CurrencySelectionSheet
        isOpen={currencySheetOpen}
        title="Currency"
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
