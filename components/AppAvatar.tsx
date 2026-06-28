import {
  Avatar,
  AvatarBadge,
  AvatarFallbackText,
  AvatarImage
} from "@/components/ui/avatar";
import { useNetwork } from "@/hooks/useNetwork";
import { avatarColors } from "@/utils/constants";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import React, { ComponentPropsWithRef, useState } from "react";

type AppAvatarProps = {
  name: string;
  uri?: string;
  unread?: boolean;
  indicator?: React.ReactNode;
} & ComponentPropsWithRef<typeof Avatar>;

const AppAvatar = ({
  name,
  uri,
  unread = false,
  indicator,
  ...props
}: AppAvatarProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isOnline } = useNetwork();

  // Offline: remote avatar URLs can't load (broken/blank), so show initials.
  const showImage = !!uri && !imageError && isOnline;
  const showFallback = !showImage;

  return (
    <Avatar
      {...props}
      className={cn(
        avatarColors[
          (name[0]?.toLowerCase() as keyof typeof avatarColors) || "a"
        ],
        props.className
      )}
    >
      {showImage && (
        <AvatarImage
          source={{ uri: uri }}
          alt={name || "Avatar"}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
        />
      )}
      {showFallback && (
        <AvatarFallbackText size={props.size} allowFontScaling={false}>
          {name[0]?.toUpperCase() || "A"}
        </AvatarFallbackText>
      )}
      {unread && <AvatarBadge className="bg-red-500" />}
      {indicator && (
        <AvatarBadge className="p-0 justify-center items-center" size="xl">
          {indicator}
        </AvatarBadge>
      )}
    </Avatar>
  );
};

export default AppAvatar;
