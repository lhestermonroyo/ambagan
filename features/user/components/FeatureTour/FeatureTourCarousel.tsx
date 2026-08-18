import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions
} from "react-native";
import { SvgXml } from "react-native-svg";
import ArtBlob from "../ArtBlob";
import { fitArt } from "../art";
import { TOUR_SLIDES } from "./slides";

/** Horizontal breathing room either side of a slide's art and copy. */
const SLIDE_PADDING = 24;

export default function FeatureTourCarousel({
  onDone
}: {
  /** Fired for Skip, for "Get started", and by the route on swipe-dismiss. */
  onDone: () => void;
}) {
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const isDark = (useColorScheme() ?? "light") === "dark";
  // Ink, not brand purple. Drawing the art in the same hue as the shape behind
  // it left the two at nearly the same luminance, so the lines sank into their
  // own backdrop. Colour belongs to the blob; the subject stays high-contrast.
  // Values are the theme's typography-900 for each scheme.
  const artColor = isDark ? "#F5F5F5" : "#262627";

  // State rather than a ref, because the dots interpolate this during render
  // and refs may not be read there. The lazy initialiser keeps the one value
  // stable across renders all the same. (The Overview hero gets away with a
  // ref only because it hands the value to a child component as a prop.)
  const [scrollX] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView>(null);
  // Settled on momentum end rather than tracked through the drag — the button
  // label swapping to "Get started" halfway through a swipe reads as a glitch.
  // The dots below follow scrollX directly, so the gesture still gets live
  // feedback. Same split as the Overview hero pager.
  const [page, setPage] = useState(0);
  const lastPage = TOUR_SLIDES.length - 1;

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPage(Math.min(Math.max(next, 0), lastPage));
    },
    [pageWidth, lastPage]
  );

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), lastPage);
      scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true });
      // Set here rather than waiting for the scroll we just started: an
      // animated scrollTo raises onMomentumScrollEnd on iOS but not dependably
      // on Android, which would strand the button on the previous label.
      setPage(clamped);
    },
    [pageWidth, lastPage]
  );

  // Art gets whatever the copy doesn't need. Capped so it can't dominate a
  // short screen, and floored so it doesn't vanish on a tall one.
  const artBoxWidth = pageWidth - SLIDE_PADDING * 2;
  const artBoxHeight = Math.max(140, Math.min(240, windowHeight * 0.28));
  // Bigger than the box it sits in so the shape runs past the drawing rather
  // than framing it, but never wider than the slide's padding allows.
  const blobSize = Math.min(artBoxWidth, artBoxHeight * 1.2);

  return (
    <VStack className="flex-1 bg-background-0">
      <HStack className="items-center justify-end p-4">
        <FormButton
          variant="link"
          size="md"
          text="Skip"
          iconEnd={
            <Icon as="chevron-right" className="text-primary-400 -ml-2 -mr-1" />
          }
          onPress={onDone}
        />
      </HStack>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // The tour sits in a modal with its own safe-area handling; left on
        // "automatic" iOS would inset the pager and knock every page off its
        // stop.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          // JS-driven because the dots interpolate `width`, which the native
          // animated module can't touch.
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        className="flex-1"
      >
        {TOUR_SLIDES.map((slide, i) => {
          const { width, height } = fitArt(
            slide.art,
            artBoxWidth,
            artBoxHeight
          );
          return (
            <VStack
              key={slide.key}
              style={{ width: pageWidth, paddingHorizontal: SLIDE_PADDING }}
              className="items-center justify-center gap-y-8"
            >
              {/* Fixed-height box so the copy below sits on the same line from
                slide to slide — the drawings themselves are all different
                shapes, and letting each one set the height makes the text
                jump as you swipe. */}
              <Box
                style={{ height: artBoxHeight }}
                className="items-center justify-center"
              >
                {/* Behind the drawing, and deaf to touches — the pager needs
                  every horizontal drag it can get. */}
                <Box
                  style={StyleSheet.absoluteFill}
                  className="items-center justify-center"
                  pointerEvents="none"
                >
                  <ArtBlob
                    size={blobSize}
                    index={i}
                    accent={slide.blob}
                    isDark={isDark}
                  />
                </Box>

                <SvgXml
                  xml={slide.art.xml}
                  width={width}
                  height={height}
                  color={artColor}
                />
              </Box>

              <VStack className="gap-y-3">
                <Text bold className="text-center text-3xl">
                  {slide.title}
                </Text>
                <Text className="text-center text-lg text-secondary-950">
                  {slide.body}
                </Text>
              </VStack>
            </VStack>
          );
        })}
      </Animated.ScrollView>

      <VStack className="px-6 pb-4 pt-2 gap-y-6">
        <HStack
          className="gap-x-1.5 items-center justify-center"
          accessibilityRole="tablist"
          accessibilityLabel={`Slide ${page + 1} of ${TOUR_SLIDES.length}`}
        >
          {TOUR_SLIDES.map((slide, i) => {
            // Neighbouring pages only — a dot is at rest unless the swipe is
            // to or from it.
            const inputRange = [
              (i - 1) * pageWidth,
              i * pageWidth,
              (i + 1) * pageWidth
            ];
            return (
              <Animated.View
                key={slide.key}
                className="h-1.5 rounded-full bg-primary-400"
                style={{
                  width: scrollX.interpolate({
                    inputRange,
                    outputRange: [6, 18, 6],
                    extrapolate: "clamp"
                  }),
                  opacity: scrollX.interpolate({
                    inputRange,
                    outputRange: [0.35, 1, 0.35],
                    extrapolate: "clamp"
                  })
                }}
              />
            );
          })}
        </HStack>

        <FormButton
          text={page === lastPage ? "Get started" : "Next"}
          onPress={() => (page === lastPage ? onDone() : goToPage(page + 1))}
        />
      </VStack>
    </VStack>
  );
}
