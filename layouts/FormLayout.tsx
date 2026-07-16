import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Pressable } from "@/components/ui/pressable";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Stack } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Fragment } from "react";
import { Platform } from "react-native";

// iOS-26 native header variant with a bottom footer bar (form actions). Mirrors
// InnerLayout: bold text title via `headerTitle`, a native `Stack.Toolbar` back
// button, and optional right-side toolbar `actions` (iOS only).
export default function FormLayout({
  children,
  title,
  onBack,
  footer,
  actions
}: {
  children: React.ReactNode;
  title: string;
  onBack: () => void;
  footer: React.ReactNode[];
  actions?: React.ReactNode;
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
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitleAlign: "left",
          headerStyle: { backgroundColor: isDark ? "#121212" : "#FFFFFF" },
          headerTintColor: tintColor,
          headerTitle: () => (
            <Text bold className="flex-1 text-xl">
              {title}
            </Text>
          ),
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
        <SafeAreaView edges={["bottom"]}>
          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              {footer.map((item, index) => (
                <Fragment key={index}>{item}</Fragment>
              ))}
            </HStack>
          </Box>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Fragment>
  );
}
