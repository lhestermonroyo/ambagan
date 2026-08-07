import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ExpenseDestinationSheet from "@/features/expense/components/ExpenseDestinationSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { ImageUp, ReceiptText, X, Zap, ZapOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Linking,
  StyleSheet,
  useColorScheme
} from "react-native";
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
 * Scan Receipt: point the camera at a receipt (or pick one from Photos) →
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
  const { setScanDraft, clearScanDraft } = states.expense();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Post-scan Group/Personal chooser — only for the generic scanner (no group or
  // book locked in), where the draft could land in either flow.
  const [destinationOpen, setDestinationOpen] = useState(false);
  const isGeneric = !groupId && !bookId;
  const cameraRef = useRef<CameraView>(null);
  // Size of the viewfinder window (the band between the black bars), used to
  // crop the capture down to exactly what the user framed.
  const viewfinderRef = useRef<{ width: number; height: number } | null>(null);
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
      // A locked group/book hands straight off; the generic scanner asks which
      // flow the receipt belongs to first (both seed from the same draft).
      if (isGeneric) {
        routeGenericScan();
      } else {
        goToExpense();
      }
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

  const handleViewfinderLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    viewfinderRef.current = { width, height };
  };

  // The shutter hands back the full sensor frame, but the preview only shows
  // the slice that fits the viewfinder window (it fills the window by cropping,
  // not by letterboxing). Reproduce that same centered crop on the captured
  // image so the scan sees exactly what the user framed — anything hidden
  // behind the black bars is dropped rather than sent along.
  const cropToViewfinder = async (photo: {
    uri: string;
    width: number;
    height: number;
  }) => {
    const view = viewfinderRef.current;
    if (!view?.width || !view?.height || !photo.width || !photo.height) {
      return photo;
    }

    // A photo whose orientation doesn't match the preview means the sensor
    // frame isn't laid out the way we assume; cropping it would cut the wrong
    // band, so hand the untouched photo through instead.
    if (view.width > view.height !== photo.width > photo.height) return photo;

    const scale = Math.max(
      view.width / photo.width,
      view.height / photo.height
    );
    const width = Math.min(photo.width, Math.round(view.width / scale));
    const height = Math.min(photo.height, Math.round(view.height / scale));

    try {
      const image = await ImageManipulator.manipulate(photo.uri)
        .crop({
          originX: Math.round((photo.width - width) / 2),
          originY: Math.round((photo.height - height) / 2),
          width,
          height
        })
        .renderAsync();
      const cropped = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 1
      });
      return {
        uri: cropped.uri,
        width: cropped.width,
        height: cropped.height
      };
    } catch {
      // Cropping is a refinement, not a requirement — scan the full frame.
      return photo;
    }
  };

  const handleCapture = async () => {
    if (scanning) return;

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!photo) return;
      await handleScan(toPickerResult(await cropToViewfinder(photo)));
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

  // True only when we *know* the user has none of that kind — an uninitialized
  // list means "not loaded yet", not "empty", and must never be read as empty
  // (the Add Expense forms resolve it properly either way).
  const hasNoneOf = (kind: "group" | "book") => {
    const { list, initialized } =
      kind === "group" ? states.group.getState() : states.book.getState();
    return initialized && list.length === 0;
  };

  // Where a generic (unlocked) scan goes. Both destinations dead-end into a
  // "create one first" empty form when the user has nothing of that kind — and
  // that form drops the draft — so decide here instead of offering a choice
  // that can't be honored: nothing at all → say so and keep the receipt out of
  // limbo; exactly one possible → skip the chooser and hand straight off.
  const routeGenericScan = () => {
    const noGroups = hasNoneOf("group");
    const noBooks = hasNoneOf("book");

    if (noGroups && noBooks) {
      clearScanDraft();
      toast({
        title: "Nowhere to add this",
        description:
          "Create a group or a personal book first, then scan your receipt again.",
        type: "warning"
      });
      return;
    }

    if (noGroups) {
      goToDestination("/books/[bookId]/add-expense");
      return;
    }

    if (noBooks) {
      goToDestination("/groups/[groupId]/add-expense");
      return;
    }

    setDestinationOpen(true);
  };

  // Route the just-scanned draft to the chosen flow, via the literal
  // "[groupId]" / "[bookId]" segment so the form defaults (and lets the user
  // change) the group/book. Same push/replace rule as goToExpense.
  const goToDestination = (target: string) => {
    setDestinationOpen(false);
    if (presentation === "tab") {
      router.push(target as any);
    } else {
      router.replace(target as any);
    }
  };

  // Dismissed without choosing — drop the draft so it can't seed a later,
  // unrelated Add Expense screen, and leave the user on the camera to re-scan.
  const handleDestinationClose = () => {
    setDestinationOpen(false);
    clearScanDraft();
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

          {/* The viewfinder: the camera lives in this window rather than behind
              the whole screen, so the black bars above and below it aren't just
              dimming — what they cover is outside the frame and gets cropped
              off the capture (see cropToViewfinder). */}
          <Box
            className="flex-1 overflow-hidden bg-black"
            onLayout={handleViewfinderLayout}
          >
            {isFocused && !scanning && (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
              />
            )}
          </Box>

          <Text className="text-white text-center px-8 pt-6 w-full">
            Fit the receipt inside the frame, then tap the shutter.
          </Text>

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

      <ExpenseDestinationSheet
        isOpen={true}
        onClose={handleDestinationClose}
        onSelectGroup={() => goToDestination("/groups/[groupId]/add-expense")}
        onSelectPersonal={() => goToDestination("/books/[bookId]/add-expense")}
        title="Where should this go?"
        subtitle="Add the scanned receipt to a group or a personal book."
        fullscreen
      />
    </Box>
  );
}
