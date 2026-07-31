import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import { User } from "@/types/user";
import { formatDate } from "@/utils/formatDate";
import React, { useEffect, useState } from "react";

export default function FriendInfoTab({
  friendId,
  name,
  email,
  avatar
}: {
  friendId: string;
  name: string;
  email: string;
  avatar: string;
}) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    services.user
      .getUserById(friendId)
      .then((res) => {
        if (!cancelled) setProfile(res.data);
      })
      .catch((error) => {
        console.error("Failed to load friend profile:", error);
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  // Fall back to the params the row was opened with while the fetch is in
  // flight (or if it fails), so the header never renders blank.
  const fullName =
    profile && `${profile.first_name} ${profile.last_name}`.trim()
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : name;
  const displayEmail = profile?.email ?? email;
  const displayAvatar = profile?.avatar ?? (avatar || undefined);
  const isPro = profile?.plan === "pro";
  const isPlaceholder = profile?.is_placeholder;

  return (
    <VStack className="gap-y-6 px-4">
      <Box className="bg-secondary-100 rounded-xl overflow-hidden">
        <DetailRow label="Email" value={displayEmail || "—"} />
        <RowDivider />
        <DetailRow
          label="Phone"
          value={loading ? "…" : profile?.phone || "Not provided"}
        />
        <RowDivider />
        <DetailRow
          label="Member since"
          value={loading ? "…" : profile ? formatDate(profile.created_at) : "—"}
        />
        <RowDivider />
        <DetailRow
          label="Account"
          value={
            loading ? "…" : isPlaceholder ? "Contact (no account)" : "Active"
          }
        />
      </Box>

      {isPlaceholder && (
        <Text className="text-sm text-secondary-950">
          This friend was added from your contacts and hasn't joined Ambagan
          yet. Their profile will fill in once they sign up with this number.
        </Text>
      )}
    </VStack>
  );
}

const DetailRow = ({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <HStack className="items-center justify-between p-4 gap-x-4">
    <Text className="text-secondary-950">{label}</Text>
    {typeof value === "string" ? (
      <Text className="flex-1 text-right" numberOfLines={1}>
        {value}
      </Text>
    ) : (
      value
    )}
  </HStack>
);

const RowDivider = () => (
  <Box className="mx-4">
    <Divider className="border-secondary-200" />
  </Box>
);
