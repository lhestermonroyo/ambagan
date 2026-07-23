import { Text } from "@/components/ui/text";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-screen, black-backed photo viewer (Facebook/Instagram style). The image
 * is pinch-to-zoom + pan, with double-tap to toggle zoom; a close button sits
 * over the top-left safe area. Renders in a native Modal so it covers the whole
 * screen (tabs, headers) rather than sitting inside a bottom sheet.
 */
export default function ImageViewerSheet({
  isOpen,
  onClose,
  uri,
  title = "Image"
}: {
  isOpen: boolean;
  onClose: () => void;
  uri: string | null;
  title?: string;
}) {
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransform = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const handleClose = () => {
    resetTransform();
    onClose();
  };

  // Pinch: scale from the current saved scale, clamped to [1, MAX_SCALE] on end.
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      const clamped = Math.min(Math.max(scale.value, 1), MAX_SCALE);
      scale.value = withTiming(clamped);
      savedScale.value = clamped;
      if (clamped === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan: only meaningful while zoomed in; persists the offset between drags.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double-tap toggles between fit and a zoomed-in view.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetTransform();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  return (
    <Modal
      visible={isOpen}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        {uri ? (
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imageWrapper, animatedStyle]}>
              <Image
                source={{ uri }}
                contentFit="contain"
                cachePolicy="memory-disk"
                style={styles.image}
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <View style={styles.empty}>
            <Text className="text-sm" style={styles.emptyText}>
              No image available
            </Text>
          </View>
        )}

        {/* Top chrome: close button + title, over the safe area. */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeButton}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000"
  },
  imageWrapper: {
    flex: 1
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)"
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#fff"
  }
});
