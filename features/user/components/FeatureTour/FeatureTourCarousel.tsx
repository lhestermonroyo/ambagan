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
import Svg, { Path, SvgXml } from "react-native-svg";
import { fitArt, type BlobAccent } from "./art";
import { TOUR_SLIDES } from "./slides";

/** Horizontal breathing room either side of a slide's art and copy. */
const SLIDE_PADDING = 24;

/**
 * Organic background shapes, drawn behind each slide's line art so it isn't
 * floating on flat colour. Origin-centred paths spanning roughly ±80, which is
 * why the blob Svg below uses a negative-origin viewBox — no transforms needed.
 *
 * Four of them, picked by slide index, so consecutive slides never show the
 * same silhouette. Each slide stacks two at different scales and opacities;
 * one shape alone reads as a flat sticker rather than depth.
 */
const BLOB_PATHS = [
  "M45.6,-52.9C58.3,-42.1,67.2,-27.1,70.4,-10.8C73.6,5.5,71.1,23.1,62.2,36.9C53.3,50.7,38,60.7,21.3,66.1C4.6,71.5,-13.5,72.3,-29.3,66.3C-45.1,60.3,-58.6,47.5,-66.4,31.9C-74.2,16.3,-76.3,-2.1,-71.3,-18.3C-66.3,-34.5,-54.2,-48.5,-40.1,-58.9C-26,-69.3,-9.9,-76.1,3.9,-80.7C17.7,-85.3,32.9,-63.7,45.6,-52.9Z",
  "M52.8,-61.5C67.4,-50.3,77.1,-32.4,79.9,-13.7C82.7,5,78.6,24.5,68.3,39.5C58,54.5,41.5,65,23.6,70.4C5.7,75.8,-13.6,76.1,-30.7,70C-47.8,63.9,-62.7,51.4,-70.9,35.3C-79.1,19.2,-80.6,-0.5,-75.5,-17.7C-70.4,-34.9,-58.7,-49.6,-44.2,-60.7C-29.7,-71.8,-12.4,-79.3,3.9,-83.9C20.2,-88.5,38.2,-72.7,52.8,-61.5Z",
  "M41.3,-49.6C53.1,-38.9,61.5,-24.9,65.3,-9.2C69.1,6.5,68.3,23.9,60.1,37.1C51.9,50.3,36.3,59.3,19.6,64.4C2.9,69.5,-14.9,70.7,-30.6,65.2C-46.3,59.7,-59.9,47.5,-67.4,32.1C-74.9,16.7,-76.3,-1.9,-71.4,-18.4C-66.5,-34.9,-55.3,-49.3,-41.4,-59.5C-27.5,-69.7,-10.9,-75.7,2.6,-78.8C16.1,-81.9,29.5,-60.3,41.3,-49.6Z",
  "M48.9,-56.8C62.4,-45.9,71.4,-29.6,74.5,-12.1C77.6,5.4,74.8,24.1,65.3,38.4C55.8,52.7,39.6,62.6,22.2,68.1C4.8,73.6,-13.8,74.7,-30.4,69.1C-47,63.5,-61.6,51.2,-69.8,35.4C-78,19.6,-79.8,0.3,-75.1,-16.7C-70.4,-33.7,-59.2,-48.4,-45.1,-59.3C-31,-70.2,-14,-77.3,1.8,-79.4C17.6,-81.5,35.4,-67.7,48.9,-56.8Z"
];

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
                  <SlideBlob
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

/**
 * The soft shape behind a slide's artwork. Two blobs in two neighbouring hues,
 * the front one scaled down and spun — the overlap mixes into a third tone,
 * which is what gives the eye something to read as depth.
 *
 * The viewBox is negative-origin because BLOB_PATHS are centred on (0,0), and
 * it's tighter than the paths' ±80 extent so the shape fills the size it's
 * given rather than sitting in its own margin.
 */
function SlideBlob({
  size,
  index,
  accent,
  isDark
}: {
  size: number;
  index: number;
  accent: BlobAccent;
  isDark: boolean;
}) {
  const back = BLOB_PATHS[index % BLOB_PATHS.length];
  const front = BLOB_PATHS[(index + 2) % BLOB_PATHS.length];

  // Dark mode needs more of the fill to survive: the same alpha that reads as a
  // soft wash on white all but disappears against #121212.
  const backOpacity = isDark ? 0.26 : 0.17;
  const frontOpacity = isDark ? 0.18 : 0.12;

  return (
    <Svg width={size} height={size} viewBox="-85 -85 170 170">
      <Path d={back} fill={accent.back} opacity={backOpacity} />
      <Path
        d={front}
        fill={accent.front}
        opacity={frontOpacity}
        scale={0.76}
        rotation={index % 2 === 0 ? 28 : -34}
      />
    </Svg>
  );
}
