import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { ImageUp, ReceiptText, X, Zap, ZapOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Below this we still autofill, but nudge the user to double-check the amount.
const LOW_CONFIDENCE = 0.5;

// The scan-receipt hand-off carries an ImagePickerSuccessResult (that's what the
// Add Expense form's proof_of_payment field takes), so a camera capture — which
// comes back as a bare {uri,width,height} — gets wrapped to match.
const toPickerResult = (asset: {
  uri: string;
  width: number;
  height: number;
}): ImagePicker.ImagePickerSuccessResult => ({
  canceled: false,
  assets: [
    {
      ...asset,
      fileName: `receipt_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      type: "image"
    }
  ]
});

type ScanReceiptViewProps = {
  /** When set, pre-locks that group in the Add Expense flow. */
  groupId?: string;
  /**
   * When set, hands off to that book's personal Add Expense form instead of the
   * group flow (autofills amount/description/currency/date/receipt the same way).
   */
  bookId?: string;
  /**
   * Where the scanner is mounted, which decides how it hands off and dismisses:
   * - `tab`: the Scan tab. Pushing the form covers the tab; replacing would
   *   swap out the whole tab navigator this screen lives in.
   * - `pushed`: stacked over the screen that opened it (a group). Replacing
   *   drops the camera from the stack, so backing out of the form returns to
   *   that screen rather than to a live camera.
   */
  presentation: "tab" | "pushed";
};

/**
 * Scan Receipt (Beta): point the camera at a receipt (or pick one from Photos) →
 * read it via the scan-receipt Edge Function → stash the parsed fields + image as
 * a scanDraft → open the Add Expense screen already filled in. Degrades
 * gracefully: an unreadable receipt still opens the form (blank/partial) with a
 * heads-up toast.
 */
export default function ScanReceiptView({
  groupId,
  bookId,
  presentation
}: ScanReceiptViewProps) {
  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const { setScanDraft } = states.expense();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme() ?? "light";
  // On the tab this screen stays mounted once visited, so tear the camera down
  // when it's off screen instead of leaving it (and the torch) running.
  const isFocused = useIsFocused();

  useFocusEffect(useCallback(() => () => setTorch(false), []));

  // App Review guideline 5.1.1(iv): the system permission dialog has to be the
  // first thing the user sees — a custom screen in front of it reads as
  // priming, and giving them a way to dismiss that screen lets them dodge the
  // request entirely. So ask the moment we know we're allowed to, and only fall
  // back to our own UI once the OS stops letting us prompt.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // On the tab this is the only way out, since the tab bar is hidden. Tabs
  // record their history, so back lands on the tab we came from; when pushed,
  // the tab router declines and the parent stack pops to the opener instead.
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/(home)" as any);
  };

  // Shared by the shutter and the Photos picker: read the image, stash the
  // draft, and hand off to the Add Expense form. Failures leave the user on the
  // camera so they can line the receipt up again and retry.
  const handleScan = async (result: ImagePicker.ImagePickerSuccessResult) => {
    if (
      !(await ensureOnline(
        "You need an internet connection to scan a receipt. Please try again when you're back online."
      ))
    ) {
      return;
    }

    setScanning(true);
    try {
      const scan = await services.expense.scanReceipt(result.assets[0].uri);

      const gotNothing =
        !scan || (!scan.amount && !scan.description && !scan.merchant);

      if (gotNothing) {
        toast({
          title: "Couldn't read that",
          description:
            "We couldn't read the receipt. You can still enter the expense manually.",
          type: "warning"
        });
      } else if (scan.confidence < LOW_CONFIDENCE) {
        toast({
          title: "Please double-check",
          description:
            "The scan may not be accurate — review the amount before saving.",
          type: "info"
        });
      }

      setScanDraft({
        amount: scan?.amount ?? null,
        description: scan?.description ?? scan?.merchant ?? null,
        currency: scan?.currency ?? null,
        date: scan?.date ?? null,
        proof_of_payment: result
      });

      setScanning(false);
      // Hand the stashed draft straight to the Add Expense screen.
      goToExpense();
    } catch {
      setScanning(false);
      toast({
        title: "Scan failed",
        description:
          "Something went wrong reading the receipt. Please try again.",
        type: "error"
      });
    }
  };

  const handleCapture = async () => {
    if (scanning) return;

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!photo) return;
      await handleScan(toPickerResult(photo));
    } catch {
      toast({
        title: "Couldn't take photo",
        description: "Something went wrong with the camera. Please try again.",
        type: "error"
      });
    }
  };

  // Scan a receipt already saved to the library instead of shooting a new one.
  const handleUploadReceipt = async () => {
    if (scanning) return;

    // No permission request here on purpose: the picker runs out of process
    // (PHPicker on iOS, the system photo picker on Android), so it hands back
    // only the chosen image and never needs library access of its own.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1
    });
    if (result.canceled) return;

    await handleScan(result);
  };

  // The Add Expense screen reads scanDraft on mount. A tab can't be replaced out
  // from under itself (see `presentation`), so push there; when pushed over a
  // group, replace so backing out returns to the group, not a live camera.
  const goToExpense = () => {
    const target = (
      bookId
        ? `/books/${bookId}/add-expense`
        : groupId
          ? `/groups/${groupId}/add-expense`
          : "/groups/[groupId]/add-expense"
    ) as any;
    if (presentation === "tab") {
      router.push(target);
    } else {
      router.replace(target);
    }
  };

  // Permission still resolving on first mount, or the system dialog is up —
  // sit behind it rather than showing anything Apple could read as priming.
  if (!permission || (!permission.granted && permission.canAskAgain)) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  // Denied for good: the OS won't prompt again, so Settings is the only way
  // back. This screen is fine by 5.1.1(iv) precisely because it comes *after*
  // the request rather than in front of it.
  if (!permission.granted) {
    return (
      <SafeAreaView className="bg-secondary-0" style={{ flex: 1 }}>
        <VStack className="flex-1 items-center justify-center gap-y-4 p-6">
          <ReceiptText
            size={48}
            color={getPrimaryHex("text-primary-500", colorScheme)}
          />
          <VStack className="gap-y-2">
            <Text bold className="text-xl text-center">
              Camera access is off
            </Text>
            <Text className="text-secondary-950 text-center">
              Turn on camera access in Settings to photograph a receipt. You can
              also pick a receipt you&apos;ve already saved to your photos.
            </Text>
          </VStack>
          <VStack className="w-full gap-y-2">
            <FormButton
              text="Open Settings"
              onPress={() => Linking.openSettings()}
            />
            <FormButton
              variant="outline"
              text={scanning ? "Reading receipt…" : "Choose from Photos"}
              onPress={handleUploadReceipt}
              disabled={scanning}
            />
            <FormButton variant="outline" text="Cancel" onPress={handleClose} />
          </VStack>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <Box className="flex-1 bg-black">
      {isFocused && !scanning && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
        />
      )}
      <SafeAreaView style={{ flex: 1 }}>
        <VStack className="flex-1">
          <Box className="p-4">
            <Pressable
              onPress={handleClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50 active:opacity-60"
            >
              <X size={22} color="#fff" />
            </Pressable>
          </Box>

          <VStack className="flex-1 items-end justify-end">
            <Text className="text-white text-center px-8 pb-6 w-full">
              Point your camera at a receipt, then tap the shutter.
            </Text>
          </VStack>

          <HStack className="items-center justify-center gap-x-10 p-6">
            <Pressable
              onPress={() => setTorch((prev) => !prev)}
              accessibilityLabel={
                torch ? "Turn off flashlight" : "Turn on flashlight"
              }
              className={`h-14 w-14 items-center justify-center rounded-full active:opacity-50 ${
                torch ? "bg-white" : "bg-white/15"
              }`}
            >
              {torch ? (
                <Zap size={24} color="#000" />
              ) : (
                <ZapOff size={24} color="#fff" />
              )}
            </Pressable>

            <Pressable
              onPress={handleCapture}
              disabled={scanning}
              accessibilityLabel="Scan receipt"
              className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 active:opacity-50"
            >
              <Box className="h-16 w-16 rounded-full bg-white" />
            </Pressable>

            <Pressable
              onPress={handleUploadReceipt}
              disabled={scanning}
              accessibilityLabel="Upload receipt from Photos"
              className="h-14 w-14 items-center justify-center rounded-full bg-white/15 active:opacity-50"
            >
              <ImageUp size={24} color="#fff" />
            </Pressable>
          </HStack>
        </VStack>
      </SafeAreaView>

      {/* Fully blacks out the camera + controls while the receipt is being
          read — the camera is also torn down above, so nothing shows through. */}
      {scanning && (
        <Box
          className="items-center justify-center bg-black"
          style={StyleSheet.absoluteFill}
        >
          <VStack className="items-center gap-y-4 px-8">
            <Spinner
              size="large"
              color={getPrimaryHex("text-primary-400", colorScheme)}
            />
            <Text bold className="text-base text-white">
              Reading receipt…
            </Text>
            <Text className="text-sm text-white/70 text-center">
              Pulling the amount and details from your receipt.
            </Text>
          </VStack>
        </Box>
      )}
    </Box>
  );
}
