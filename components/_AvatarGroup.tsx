import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
  AvatarGroup as UIAvatarGroup
} from './ui/avatar';

type AvatarGroupProps = {
  items: {
    id: string;
    avatar: string | null;
    name: string;
  }[];
  maxDisplay?: number;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | undefined;
};

const AvatarGroup = ({ items, maxDisplay = 3, size }: AvatarGroupProps) => {
  return (
    <UIAvatarGroup className="self-start flex-row">
      {items.length > maxDisplay && (
        <Avatar
          size={size}
          style={{ marginLeft: '-3%' }}
          className="border-primary-400 border-1 bg-slate-700"
        >
          <AvatarFallbackText>
            {'+ ' + (items.length - maxDisplay)}
          </AvatarFallbackText>
        </Avatar>
      )}
      {items.slice(0, maxDisplay).map((item, index) => (
        <Avatar
          className="border-primary-400 border-1 p-1"
          key={item.id}
          size={size}
          style={{
            marginLeft: maxDisplay - index === 1 ? 0 : '-3%'
          }}
        >
          <AvatarFallbackText>{item.name}</AvatarFallbackText>
          <AvatarImage
            alt={item.name}
            source={{
              uri: item.avatar || undefined
            }}
          />
        </Avatar>
      ))}
    </UIAvatarGroup>
  );
};

export default AvatarGroup;
