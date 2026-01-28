import {
  AvatarBadge,
  AvatarFallbackText,
  AvatarImage,
  Avatar as UIAvatar
} from '@/components/ui/avatar';
import React, { ComponentPropsWithRef, useState } from 'react';

type AppAvatar = {
  name: string;
  uri?: string;
  unread?: boolean;
} & ComponentPropsWithRef<typeof UIAvatar>;

const Avatar = ({ name, uri, unread = false, ...props }: AppAvatar) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showFallback = !uri || imageError;

  return (
    <UIAvatar {...props}>
      {uri && (
        <AvatarImage
          source={{ uri: uri }}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
        />
      )}
      {showFallback && (
        <AvatarFallbackText size="lg" allowFontScaling={false}>
          {name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase() || 'A'}
        </AvatarFallbackText>
      )}
      {unread && <AvatarBadge className="bg-red-500" />}
    </UIAvatar>
  );
};

export default Avatar;
