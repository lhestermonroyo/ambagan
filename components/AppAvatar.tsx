import {
  Avatar,
  AvatarBadge,
  AvatarFallbackText,
  AvatarImage
} from "@/components/ui/avatar";
import { avatarColors } from "@/utils/constants";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import React, { ComponentPropsWithRef, useState } from "react";

type AppAvatarProps = {
  name: string;
  uri?: string;
  unread?: boolean;
} & ComponentPropsWithRef<typeof Avatar>;

const AppAvatar = ({ name, uri, unread = false, ...props }: AppAvatarProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showFallback = !uri || imageError;

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
      {uri && (
        <AvatarImage
          source={{ uri: uri }}
          alt={name || "Avatar"}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
        />
      )}
      {showFallback && (
        <AvatarFallbackText size={props.size} allowFontScaling={false}>
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "A"}
        </AvatarFallbackText>
      )}
      {unread && <AvatarBadge className="bg-red-500" />}
    </Avatar>
  );
};

export default AppAvatar;
