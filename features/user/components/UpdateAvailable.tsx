import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { UpdateGate } from "@/types/appVersion";
import { useState } from "react";
import {
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import ArtBlob from "./ArtBlob";
import { ART_LAUNCH_APP, BLOB_ACCENTS, fitArt } from "./art";

/** Named so the copy reads right on both stores once Android ships. */
const STORE_NAME = Platform.OS === "ios" ? "App Store" : "Play Store";

/** Matches the feature tour's slide padding, so the two screens share a gutter. */
const SCREEN_PADDING = 24;

export default function UpdateAvailable({
  gate,
  onUpdate,
  onLater
}: {
  gate: UpdateGate;
  onUpdate: () => Promise<void> | void;
  /** Absent for a required update — there is no "later" to offer. */
  onLater?: () => void;
}) {
  const isDark = (useColorScheme() ?? "light") === "dark";
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [opening, setOpening] = useState(false);
  const required = gate.status === "required";

  // Ink, not brand purple — the colour belongs to the blob, the subject stays
  // high-contrast. Same reasoning and same values as the feature tour.
  const artColor = isDark ? "#F5F5F5" : "#262627";

  // Shorter than the tour's box: this screen carries release notes and two
  // buttons under the drawing, where a slide carries only a title and a line.
  const artBoxWidth = windowWidth - SCREEN_PADDING * 2;
  const artBoxHeight = Math.max(140, Math.min(220, windowHeight * 0.24));
  const art = fitArt(ART_LAUNCH_APP, artBoxWidth, artBoxHeight);
  // Bigger than the drawing so the shape runs past it rather than framing it.
  const blobSize = Math.min(artBoxWidth, artBoxHeight * 1.2);

  const handleUpdate = async () => {
    // The store hand-off is a round trip through the OS, so the button has to
    // show it's working — a tap that looks inert gets tapped again, and the
    // second tap lands after we've already left the app.
    setOpening(true);
    try {
      await onUpdate();
    } finally {
      setOpening(false);
    }
  };

  return (
    <VStack className="flex-1 bg-background-0">
      {/* Centred when the copy is short, scrollable when release notes make it
          long — hence flexGrow rather than flex:1 on the content container. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32
        }}
        showsVerticalScrollIndicator={false}
      >
        <VStack className="gap-y-8 items-center">
          <VStack className="items-center gap-y-5">
            {/* Fixed-height box so the copy below sits in the same place
                whichever variant is showing. */}
            <Box
              style={{ height: artBoxHeight }}
              className="items-center justify-center"
            >
              {/* Behind the drawing, and deaf to touches. */}
              <Box
                style={StyleSheet.absoluteFill}
                className="items-center justify-center"
                pointerEvents="none"
              >
                {/* The drawing is the same either way — this is one message,
                    "there's a newer Ambagan". Urgency is carried by the accent
                    (brand violet vs. the amber/rose warning pair) and by the
                    copy and the missing "Not now", not by a second icon. */}
                <ArtBlob
                  size={blobSize}
                  index={required ? 1 : 0}
                  accent={required ? BLOB_ACCENTS.amber : BLOB_ACCENTS.violet}
                  isDark={isDark}
                />
              </Box>

              <SvgXml
                xml={ART_LAUNCH_APP.xml}
                width={art.width}
                height={art.height}
                color={artColor}
              />
            </Box>

            <VStack className="gap-y-2 items-center">
              <Text bold className="text-2xl text-center">
                {required ? "Update required" : "A new version is here"}
              </Text>
              <Text className="text-secondary-950 text-center px-2">
                {required
                  ? `This version of Ambagan is no longer supported. Update from the ${STORE_NAME} to keep your expenses and settlements in sync.`
                  : `Ambagan ${gate.latestVersion} is ready in the ${STORE_NAME}. Updating takes a moment and keeps everything working the way it should.`}
              </Text>
            </VStack>

            {/* Both versions, always — "what am I on, and what am I moving to"
                is the one question a person actually has here, and it's also
                what makes a support screenshot useful. */}
            <HStack className="items-center gap-x-2">
              <Text className="text-sm text-secondary-950">
                {gate.installedVersion}
              </Text>
              <Text className="text-sm text-secondary-950">→</Text>
              <Text bold className="text-sm text-primary-500">
                {gate.latestVersion}
              </Text>
            </HStack>
          </VStack>

          {/* Dropped entirely when empty rather than rendered as a heading over
              nothing — an empty "What's new" reads as a broken screen. */}
          {gate.releaseNotes.length > 0 && (
            <VStack className="w-full gap-y-3 bg-background-50 rounded-2xl p-5">
              <Text bold className="text-sm">
                What&apos;s new
              </Text>
              <VStack className="gap-y-2">
                {gate.releaseNotes.map((note, index) => (
                  <HStack key={index} className="gap-x-2 items-start">
                    <Text className="text-sm text-primary-500">•</Text>
                    <Text className="text-sm text-secondary-950 flex-1">
                      {note}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          )}
        </VStack>
      </ScrollView>

      <SafeAreaView edges={["bottom"]}>
        <VStack className="w-full gap-y-2 px-6 pb-4">
          <FormButton
            text={required ? "Update now" : "Update"}
            loading={opening}
            onPress={handleUpdate}
          />
          {onLater && (
            <FormButton text="Not now" variant="link" onPress={onLater} />
          )}
        </VStack>
      </SafeAreaView>
    </VStack>
  );
}
