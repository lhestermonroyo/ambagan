import FormButton from "@/components/FormButton";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { useEffect, useState } from "react";
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
};

// A search "drawer" that slides down from the top over a dimming backdrop.
// The overlay itself is a native `Modal` (so it renders above the native header,
// like the iOS search bar), while the search field is our own `SearchInput` +
// `FormButton` rather than the native UISearchBar.
export default function SearchDrawer({
  isOpen,
  onClose,
  onCancel,
  value,
  onChangeText,
  onSetSearching,
  placeholder = "Search",
  cancelLabel = "Cancel"
}: SearchDrawerProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  // Seeded large so the panel starts fully hidden before onLayout measures it.
  const panelHeight = useSharedValue(300);
  const [mounted, setMounted] = useState(isOpen);

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
      { translateY: interpolate(progress.value, [0, 1], [-panelHeight.value, 0]) }
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
      {/* Dim backdrop — tap to dismiss (keeps the current query). */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.35)" }
          ]}
          onPress={onClose}
        />
      </Animated.View>

      {/* Panel that slides down from the top edge. */}
      <Animated.View
        onLayout={(e) => {
          panelHeight.value = e.nativeEvent.layout.height;
        }}
        style={[styles.panel, panelStyle]}
      >
        <Box className="bg-background-0" style={{ paddingTop: insets.top + 8 }}>
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
