import { Menu, MenuItem, MenuItemLabel } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { getErrorHex, getSecondaryHex } from "@/utils/getColorHex";
import { Ellipsis, type LucideIcon } from "lucide-react-native";
import { useColorScheme } from "nativewind";

export type AndroidHeaderMenuItem = {
  // Stable key + the value the underlying collection matches on.
  key: string;
  label: string;
  // Optional leading lucide icon, mirroring the iOS MenuAction SF Symbol.
  icon?: LucideIcon;
  // Renders the item in the error color, matching iOS `destructive`.
  destructive?: boolean;
  onPress: () => void;
};

// Android counterpart to an iOS `Stack.Toolbar.Menu`: an ellipsis button in the
// native `headerRight` that opens a gluestack dropdown. SF Symbols and the
// liquid-glass toolbar are iOS-only, so the tab/inner layouts render this in
// their `androidActions` slot instead.
export default function AndroidHeaderMenu({
  items,
  accessibilityLabel
}: {
  items: AndroidHeaderMenuItem[];
  accessibilityLabel: string;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme ?? "light";
  const defaultColor = getSecondaryHex("text-secondary-950", scheme);
  const errorColor = getErrorHex("text-error-600", scheme);

  return (
    <Menu
      placement="bottom right"
      offset={4}
      trigger={({ ...triggerProps }) => (
        <Pressable
          className="pr-1"
          aria-label={accessibilityLabel}
          {...triggerProps}
        >
          <Ellipsis size={24} color={defaultColor} />
        </Pressable>
      )}
    >
      {items.map((item) => {
        const ItemIcon = item.icon;
        const color = item.destructive ? errorColor : defaultColor;
        return (
          <MenuItem
            key={item.key}
            textValue={item.label}
            onPress={item.onPress}
          >
            {ItemIcon && (
              <ItemIcon size={18} color={color} style={{ marginRight: 8 }} />
            )}
            <MenuItemLabel
              className={item.destructive ? "text-error-600" : undefined}
            >
              {item.label}
            </MenuItemLabel>
          </MenuItem>
        );
      })}
    </Menu>
  );
}
