import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Stack } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Fragment, ReactNode } from "react";
import { Platform } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export type TabHeaderAction = {
  // Stable key for the mapped list.
  key: string;
  // SF Symbol name — rendered as a native, iOS 26 liquid-glass toolbar button.
  sf: SFSymbol;
  // Android has no SF Symbols, so it renders this lucide icon in `headerRight`.
  lucide: LucideIcon;
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
          headerShadowVisible: false,
          headerTitle: () => (
            <Text bold className="flex-1 text-3xl">
              {title}
            </Text>
          ),
          // iOS renders its actions via the `Stack.Toolbar` below (liquid glass);
          // Android has no toolbar, so the actions go in the native `headerRight`
          // as tinted lucide-icon buttons instead.
          headerRight:
            Platform.OS === "android" && actions && actions.length > 0
              ? () => (
                  <HStack className="items-center gap-x-8 pr-1">
                    {actions.map((action) => (
                      <Button
                        key={action.key}
                        variant="link"
                        className="rounded-full"
                        onPress={action.onPress}
                        aria-label={action.label}
                      >
                        <action.lucide color={tintColor} />
                      </Button>
                    ))}
                  </HStack>
                )
              : undefined
        }}
      />

      {/* SF Symbols are iOS-only; on Android the actions live in `headerRight`. */}
      {Platform.OS === "ios" && actions && actions.length > 0 && (
        <Stack.Toolbar placement="right" tintColor="red">
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
