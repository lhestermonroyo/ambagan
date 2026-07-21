import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Stack } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Fragment } from "react";
import { Platform } from "react-native";

// iOS-26 native header. The title keeps the app's bold text UI via a custom
// `headerTitle`; the back button renders as a native toolbar button
// (liquid-glass on iOS 26) through `Stack.Toolbar`, matching TabLayout.
//
// `actions` are the right-side toolbar items — pass `Stack.Toolbar.Button` /
// `Stack.Toolbar.Menu` elements. They render in the native liquid-glass bar on
// iOS only (SF Symbols are iOS-only, same tradeoff as TabLayout).
//
// For multiple items pass an ARRAY (with keys), never a `<>…</>` fragment: the
// native toolbar extracts items via `React.Children.toArray`, which does not
// descend into a Fragment, so fragment-wrapped items are silently dropped.
export default function InnerLayout({
  children,
  title,
  onBack,
  actions,
  gestureEnabled
}: {
  children: React.ReactNode;
  title: string;
  onBack: () => void;
  actions?: React.ReactNode;
  // Set false on screens with horizontal row-swipe gestures (e.g. swipe-to-
  // delete lists) so the native back-swipe doesn't pop the screen mid-swipe.
  // Defaults to the native behavior (edge swipe-back enabled) when omitted.
  gestureEnabled?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme ?? "light";
  const isDark = scheme === "dark";
  const tintColor = getPrimaryHex("text-primary-600", scheme);

  return (
    <Fragment>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          ...(gestureEnabled === undefined ? {} : { gestureEnabled }),
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitleAlign: "left",
          headerStyle: { backgroundColor: isDark ? "#121212" : "#FFFFFF" },
          headerTintColor: tintColor,
          headerTitle: () => (
            <Text bold className="flex-1 text-xl self-start">
              {title}
            </Text>
          ),
          // Android has no Stack.Toolbar back button; render a plain header left.
          ...(Platform.OS === "android"
            ? {
                headerLeft: () => (
                  <Pressable className="pr-4" onPress={onBack}>
                    <ChevronLeft size={24} color={tintColor} />
                  </Pressable>
                )
              }
            : {})
        }}
      />

      {Platform.OS === "ios" && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.left"
            tintColor={tintColor}
            accessibilityLabel="Go back"
            onPress={onBack}
          />
        </Stack.Toolbar>
      )}

      {Platform.OS === "ios" && actions && (
        <Stack.Toolbar placement="right">{actions}</Stack.Toolbar>
      )}

      <KeyboardAvoidingView
        className="flex-1 bg-background-0"
        behavior="padding"
      >
        {children}
      </KeyboardAvoidingView>
    </Fragment>
  );
}
