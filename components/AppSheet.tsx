import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { VStack } from "@/components/ui/vstack";
import { useBanner } from "@/hooks/useBanner";
import React from "react";

type AppSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fullscreen (snapPoints=[100]) sheet: hides the drag indicator and pads the
   * top by `sheetTopInset` so content clears the notch/status banner. Use for
   * multi-step forms that own the whole screen. Defaults to a large 90%-height
   * sheet with a drag indicator.
   */
  fullscreen?: boolean;
  /**
   * Override the snap points entirely — e.g. `[30]` for a short confirm sheet
   * that grows to `[90]` when it has more to show. When omitted, resolves to
   * `[100]` for fullscreen and `[90]` otherwise.
   */
  snapPoints?: number[];
  /** Wrap the body in {@link KeyboardAvoidingSheet} so footer buttons rise
   * above the keyboard. Defaults to true for fullscreen sheets. */
  keyboardAvoiding?: boolean;
  /** Force the drag indicator on/off. Defaults to hidden for fullscreen. */
  showDragIndicator?: boolean;
  /** Replaces the inner content wrapper classes. Defaults to `w-full flex-1`. */
  contentClassName?: string;
  /** Sticky footer rendered as a sibling below the scrollable content (e.g. a
   * "Done" / "Save" button row). */
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The shared shell for the app's large bottom sheets — the `Actionsheet` +
 * backdrop + `p-0` content + drag-indicator / keyboard-avoiding / top-inset
 * boilerplate that every 90%- and 100%-height sheet used to repeat. Callers
 * provide just their header + content (and an optional {@link footer}).
 */
export default function AppSheet({
  isOpen,
  onClose,
  fullscreen = false,
  snapPoints,
  keyboardAvoiding = fullscreen,
  showDragIndicator = !fullscreen,
  contentClassName,
  footer,
  children
}: AppSheetProps) {
  const { sheetTopInset } = useBanner();
  const points = snapPoints ?? (fullscreen ? [100] : [90]);

  const body = (
    <>
      <VStack
        className={contentClassName ?? "w-full flex-1"}
        style={fullscreen ? { paddingTop: sheetTopInset - 8 } : undefined}
      >
        {children}
      </VStack>
      {footer}
    </>
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={points}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        {showDragIndicator && (
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
        )}
        {keyboardAvoiding ? (
          <KeyboardAvoidingSheet>{body}</KeyboardAvoidingSheet>
        ) : (
          body
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}
