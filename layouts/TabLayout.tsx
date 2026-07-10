import { Text } from "@/components/ui/text";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { Fragment, ReactNode } from "react";
import { Platform } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export type TabHeaderAction = {
  // Stable key for the mapped list.
  key: string;
  // SF Symbol name — rendered as a native, iOS 26 liquid-glass toolbar button.
  sf: SFSymbol;
  // Spoken by VoiceOver; also the button's fallback title.
  label: string;
  onPress: () => void;
};

// Shared native-header config for the tab screens (Groups, Friends, Profile).
// The nested Stack `_layout` supplies the large title + themed colors; this
// component sets the per-screen title and, on iOS, the right-side action
// buttons via `Stack.Toolbar` so they render inside the iOS 26 liquid-glass bar.
// It renders no visual chrome itself — just the native header configuration
// plus the screen content.
export default function TabLayout({
  title,
  actions,
  children
}: {
  title: string;
  actions?: TabHeaderAction[];
  children: ReactNode;
}) {
  const { colorScheme } = useColorScheme();
  const tintColor = getPrimaryHex("text-primary-600", colorScheme ?? "light");

  return (
    <Fragment>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          headerTitle: () => (
            <Text bold className="flex-1 text-3xl">
              {title}
            </Text>
          )
        }}
      />

      {/* SF Symbols are iOS-only; on Android the header shows just the title. */}
      {Platform.OS === "ios" && actions && actions.length > 0 && (
        <Stack.Toolbar placement="right">
          {actions.map((action) => (
            <Stack.Toolbar.Button
              key={action.key}
              icon={action.sf}
              tintColor={tintColor}
              accessibilityLabel={action.label}
              onPress={action.onPress}
            />
          ))}
        </Stack.Toolbar>
      )}

      {children}
    </Fragment>
  );
}
