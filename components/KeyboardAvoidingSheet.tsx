import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import React from "react";
import { Platform } from "react-native";

/**
 * Wraps a bottom-sheet's content so its bottom buttons rise above the keyboard.
 * The gluestack Actionsheet has no built-in keyboard handling — on iOS we pad by
 * the keyboard height; on Android we rely on the window's adjustResize (adding a
 * behavior there would double-shift). Place directly inside ActionsheetContent.
 */
export default function KeyboardAvoidingSheet({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, width: "100%" }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
