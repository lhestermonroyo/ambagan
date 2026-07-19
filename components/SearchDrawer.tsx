import FormButton from "@/components/FormButton";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { useNetwork } from "@/hooks/useNetwork";
import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SearchDrawerProps = {
  isOpen: boolean;
  // Dismiss the drawer, keeping the current query (tapping the backdrop).
  onClose: () => void;
  // Dismiss the drawer and clear the query (the "Cancel" button).
  onCancel: () => void;
  value: string;
  onChangeText: (text: string) => void;
  onSetSearching?: (searching: boolean) => void;
  placeholder?: string;
  cancelLabel?: string;
  // The results to show once there is an active query. Rendered on a solid,
  // interactive sheet below the input so the items stay tappable — unlike the
  // dim backdrop, which sits over an inert (masked) screen behind the modal.
  children?: ReactNode;
};

// A search "drawer" that slides down from the top over a dimming backdrop.
// The overlay itself is a native `Modal` (so it renders above the native header,
// like the iOS search bar), while the search field is our own `SearchInput` +
// `FormButton` rather than the native UISearchBar.
//
// With no `children` (no active query) it's just the input over a dim backdrop
// you can tap to dismiss. Once `children` are supplied they render on a solid
// sheet filling the space under the input, so results remain fully interactive
// instead of being masked by the backdrop.
export default function SearchDrawer({
  isOpen,
  onClose,
  onCancel,
  value,
  onChangeText,
  onSetSearching,
  placeholder = "Search",
  cancelLabel = "Cancel",
  children
}: SearchDrawerProps) {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetwork();
  const progress = useSharedValue(0);
  // Seeded large so the panel starts fully hidden before onLayout measures it.
  const panelHeight = useSharedValue(300);
  // The measured input-panel height (JS side), used to inset the results sheet
  // so the list starts just below the input rather than behind it.
  const [inputHeight, setInputHeight] = useState(insets.top + 64);
  const [mounted, setMounted] = useState(isOpen);

  const hasResults = children != null && children !== false;

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 240 });
    } else {
      progress.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [-panelHeight.value, 0])
      }
    ]
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Transparent tap-catcher — tap outside the input to dismiss (keeps the
        current query). Intentionally undimmed so the screen behind stays fully
        visible. When results are showing it sits behind the solid sheet. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Solid, interactive results sheet — fills the area under the input so
        the underlying screen is never in the way and every row stays tappable. */}
      {hasResults && (
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Box
            className="bg-background-0 flex-1"
            style={{ paddingTop: inputHeight }}
          >
            {children}
          </Box>
        </Animated.View>
      )}

      {/* Panel that slides down from the top edge, holding the input. Rendered
        above the results sheet so the field stays visible and tappable. */}
      <Animated.View
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          panelHeight.value = height;
          setInputHeight(height);
        }}
        style={[styles.panel, panelStyle]}
      >
        <Box
          className="bg-background-0"
          style={{ paddingTop: insets.top + (isOnline ? 8 : 100) }}
        >
          <HStack className="items-center gap-x-2 px-4 pb-3">
            <Box className="flex-1">
              <SearchInput
                value={value}
                onChangeText={onChangeText}
                onSetSearching={onSetSearching}
                placeholder={placeholder}
                autoFocus
                returnKeyType="search"
              />
            </Box>
            <FormButton
              size="md"
              variant="link"
              text={cancelLabel}
              onPress={onCancel}
            />
          </HStack>
        </Box>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0
  }
});
