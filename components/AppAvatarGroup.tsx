import { Avatar, AvatarFallbackText, AvatarGroup } from "./ui/avatar";

type AppAvatarGroupProps = {
  items: {
    id: string;
    avatar: string | null;
    name: string;
  }[];
  maxDisplay?: number;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | undefined;
};

const AppAvatarGroup = ({
  items,
  maxDisplay = 3,
  size
}: AppAvatarGroupProps) => {
  return (
    <AvatarGroup className="self-start">
      {items.slice(0, maxDisplay).map((avatar, index) => {
        return (
          <Avatar
            key={index}
            size={size}
            className={`border-2 border-outline-0 ${items.length === 1 ? "" : "mr-[-10]"} z-[${index + 1}]`}
          >
            <AvatarFallbackText className="text-background-0">
              {avatar.name}
            </AvatarFallbackText>
          </Avatar>
        );
      })}
      {items.length > maxDisplay && (
        <Avatar
          size={size}
          className={`border-primary-400 border-1 bg-slate-700`}
        >
          <AvatarFallbackText>
            {"+ " + (items.length - maxDisplay)}
          </AvatarFallbackText>
        </Avatar>
      )}
    </AvatarGroup>
  );
  // return (
  //   <AvatarGroup className="self-start flex-row">
  //     {items.length > maxDisplay && (
  //       <Avatar
  //         size={size}
  //         style={{ marginLeft: "6%" }}
  //         className="border-primary-400 border-1 bg-slate-700"
  //       >
  //         <AvatarFallbackText>
  //           {"+ " + (items.length - maxDisplay)}
  //         </AvatarFallbackText>
  //       </Avatar>
  //     )}
  //     {items.slice(0, maxDisplay).map((item, index) => (
  //       <Avatar
  //         className="border-primary-400 border-1 p-1"
  //         key={item.id}
  //         size={size}
  //         style={{
  //           marginLeft: maxDisplay - index === 1 ? 0 : "6%"
  //         }}
  //       >
  //         <AvatarFallbackText>{item.name}</AvatarFallbackText>
  //         <AvatarImage
  //           alt={item.name}
  //           source={{
  //             uri: item.avatar || undefined
  //           }}
  //         />
  //       </Avatar>
  //     ))}
  //   </AvatarGroup>
  // );
};

export default AppAvatarGroup;
