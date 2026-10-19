import AppAvatar from "@/components/AppAvatar";
import CategoryIcon from "@/components/CategoryIcon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { groupEntryCurrency } from "@/features/group/utils/groupCurrency";
import { groupAdmins } from "@/features/group/utils/groupRoles";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { categories, currencies } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronRight } from "lucide-react-native";
import React, { Fragment, useMemo } from "react";
import { useColorScheme } from "react-native";

/** The group's metadata. The roster lives on its own tab — see
 *  {@link GroupMembersTab} — so `onViewMembers` lets the Members row here jump
 *  there rather than dead-end on a count. */
export default function GroupDetailsTab({
  onViewMembers
}: {
  onViewMembers?: () => void;
}) {
  // Subscribed (not getState()) so a roster edit repaints the counts here right
  // away.
  const { details, memberList } = states.group();
  const { details: userDetails } = states.user();

  // Clearing the store during back navigation unmounts the populated view.
  // This wrapper always calls the same two store hooks, even while loading.
  if (!details || !memberList || !userDetails) return null;

  return (
    <GroupDetailsContent
      details={details}
      memberList={memberList}
      userId={userDetails.id}
      onViewMembers={onViewMembers}
    />
  );
}

function GroupDetailsContent({
  details,
  memberList,
  userId,
  onViewMembers
}: {
  details: Group;
  memberList: Member[];
  userId: string;
  onViewMembers?: () => void;
}) {
  const colorScheme = useColorScheme() ?? "light";

  const admins = useMemo(
    () => groupAdmins(details, memberList),
    [details, memberList]
  );

  const category = useMemo(() => {
    if (!details) return null;
    return categories.find((c) => c.value === details.category) ?? null;
  }, [details?.category]);

  const currency = useMemo(
    () => currencies.find((c) => c.value === details?.currency) ?? null,
    [details?.currency]
  );

  // Only interesting when it differs from the group's own currency — on every
  // other group it would restate the row above it.
  const entryCurrency = useMemo(() => {
    const resolved = groupEntryCurrency({
      currency: details?.currency,
      default_expense_currency: details?.default_expense_currency
    });
    if (!resolved || resolved === details?.currency) return null;
    return currencies.find((c) => c.value === resolved) ?? null;
  }, [details?.default_expense_currency, details?.currency]);

  return (
    <Fragment>
      <VStack className="gap-y-6 px-4">
        <Box className="bg-secondary-100 rounded-xl overflow-hidden">
          <DetailRow label="Mode" value={<Text>Group</Text>} />
          <RowDivider />
          {/* The REPORTING currency — what Stats and the settlement totals
              convert into. It also seeds new expenses unless the row below
              overrides it, which is why this one isn't labelled "default". */}
          <DetailRow
            label={entryCurrency ? "Group Currency" : "Currency"}
            value={
              <Text>
                {currency ? currency.subtitle : (details.currency ?? "PHP")} (
                {currency?.sign ?? details.currency ?? "PHP"})
              </Text>
            }
          />
          {entryCurrency && (
            <>
              <RowDivider />
              <DetailRow
                label="New Expenses"
                value={
                  <Text>
                    {entryCurrency.subtitle} ({entryCurrency.sign})
                  </Text>
                }
              />
            </>
          )}
          <RowDivider />
          <DetailRow
            label="Category"
            value={
              category ? (
                <HStack className="items-center gap-x-3">
                  <CategoryIcon icon={category.icon} size={16} />
                  <Text className="text-sm">{category.label}</Text>
                </HStack>
              ) : (
                <Text className="text-sm">-</Text>
              )
            }
          />
          <RowDivider />
          <Pressable onPress={onViewMembers} disabled={!onViewMembers}>
            <DetailRow
              label="Members"
              value={
                <HStack className="items-center gap-x-1">
                  <Text>
                    {memberList.length}{" "}
                    {memberList.length === 1 ? "member" : "members"}
                  </Text>
                  {!!onViewMembers && (
                    <ChevronRight
                      size={16}
                      color={getSecondaryHex("text-secondary-950", colorScheme)}
                    />
                  )}
                </HStack>
              }
            />
          </Pressable>
          <RowDivider />
          <DetailRow
            label="Owner"
            value={
              <HStack className="gap-x-3 items-center">
                <AppAvatar
                  name={details?.admin.first_name}
                  uri={details?.admin.avatar!}
                  size="sm"
                />
                <Text>
                  {`${details?.admin.first_name} ${details?.admin.last_name}`}
                  {details.admin.id === userId && " (You)"}
                </Text>
              </HStack>
            }
          />
          {/* Only worth a row once someone else can manage the group — on a
              single-admin group it would just restate the owner above. */}
          {admins.length > 1 && (
            <>
              <RowDivider />
              <DetailRow
                label="Admins"
                value={
                  <Text>
                    {admins.length} {admins.length === 1 ? "admin" : "admins"}
                  </Text>
                }
              />
            </>
          )}
          <RowDivider />
          <DetailRow
            label="Created at"
            value={<Text>{formatDate(details?.created_at || "")}</Text>}
          />
        </Box>
      </VStack>
    </Fragment>
  );
}

const RowDivider = () => (
  <Box className="mx-4">
    <Divider className="border-secondary-200" />
  </Box>
);

const DetailRow = ({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) => {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
};
