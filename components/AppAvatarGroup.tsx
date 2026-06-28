import { useNetwork } from "@/hooks/useNetwork";
import { avatarColors } from "@/utils/constants";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useState } from "react";
import {
  Avatar,
  AvatarFallbackText,
  AvatarGroup,
  AvatarImage
} from "./ui/avatar";

type AppAvatarGroupProps = {
  items: {
    id: string;
    uri: string | undefined;
    name: string;
  }[];
  maxDisplay?: number;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | undefined;
};

type AvatarGroupItemProps = {
  avatar: { id: string; uri: string | undefined; name: string };
  size: AppAvatarGroupProps["size"];
  isLast: boolean;
  index: number;
};

const AvatarGroupItem = ({ avatar, size, isLast, index }: AvatarGroupItemProps) => {
  const [imageError, setImageError] = useState(false);
  const { isOnline } = useNetwork();

  // Offline: remote avatar URLs can't load (broken/blank), so show initials.
  const showImage = !!avatar.uri && !imageError && isOnline;
  const showFallback = !showImage;

  return (
    <Avatar
      key={avatar.id}
      size={size}
      className={cn(
        avatarColors[
          (avatar.name[0]?.toLowerCase() as keyof typeof avatarColors) || "a"
        ],
        !isLast ? "mr-[-10]" : "",
        `z-${index + 1}`,
        "border-2 border-outline-0"
      )}
    >
      {showImage && (
        <AvatarImage
          source={{ uri: avatar.uri }}
          alt={avatar.name || "Avatar"}
          onError={() => setImageError(true)}
        />
      )}
      {showFallback && (
        <AvatarFallbackText className="text-background-0">
          {avatar.name[0]?.toUpperCase() || "A"}
        </AvatarFallbackText>
      )}
    </Avatar>
  );
};

const AppAvatarGroup = ({
  items,
  maxDisplay = 3,
  size
}: AppAvatarGroupProps) => {
  const displayCount = Math.min(items.length, maxDisplay);
  const hasOverflow = items.length > maxDisplay;

  return (
    <AvatarGroup className="items-center">
      {items.slice(0, maxDisplay).map((avatar, index) => {
        const isLast = index === displayCount - 1 && !hasOverflow;
        return (
          <AvatarGroupItem
            key={avatar.id}
            avatar={avatar}
            size={size}
            isLast={isLast}
            index={index}
          />
        );
      })}
      {hasOverflow && (
        <Avatar
          size={size}
          className={cn(
            "border-2 border-outline-0 bg-slate-700",
            `z-${maxDisplay + 1}`
          )}
        >
          <AvatarFallbackText className="text-sm text-secondary-950">
            {"+ " + (items.length - maxDisplay)}
          </AvatarFallbackText>
        </Avatar>
      )}
    </AvatarGroup>
  );
};

export default AppAvatarGroup;
