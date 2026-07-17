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
import { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NewExpensePickerSheet from "./NewExpensePickerSheet";

// Below this we still autofill, but nudge the user to double-check the amount.
const LOW_CONFIDENCE = 0.5;

// The scan-receipt hand-off carries an ImagePickerSuccessResult (that's what the
// new-expense form's proof_of_payment field takes), so a camera capture — which
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
  /** When set, pre-locks that group in the new-expense flow. */
  groupId?: string;
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
 * a scanDraft → open the Custom Expense flow already filled in. Degrades
 * gracefully: an unreadable receipt still opens the form (blank/partial) with a
 * heads-up toast.
 */
export default function ScanReceiptView({
  groupId,
  presentation
}: ScanReceiptViewProps) {
  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const { setScanDraft, clearScanDraft, setPendingQuickAdd } = states.expense();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Opened once a scan is parsed: lets the user route the draft into Quick Add
  // or the Custom flow. The draft is already stashed in the store by then.
  const [pickerOpen, setPickerOpen] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme() ?? "light";
  // On the tab this screen stays mounted once visited, so tear the camera down
  // when it's off screen instead of leaving it (and the torch) running.
  const isFocused = useIsFocused();

  useFocusEffect(useCallback(() => () => setTorch(false), []));

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
  // draft, and hand off to the new-expense form. Failures leave the user on the
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
      // Hand the draft off to whichever flow the user picks next.
      setPickerOpen(true);
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

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({
        title: "Photo access needed",
        description: "Allow photo library access to upload a receipt image.",
        type: "warning"
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1
    });
    if (result.canceled) return;

    await handleScan(result);
  };

  // Custom flow: the new-expense route reads scanDraft on mount. A tab can't be
  // replaced out from under itself (see `presentation`), so push there; when
  // pushed over a group, replace so backing out returns to the group, not a
  // live camera.
  const handleChooseCustom = () => {
    setPickerOpen(false);
    const target = (
      groupId
        ? `/groups/${groupId}/new-expense`
        : "/groups/[groupId]/new-expense"
    ) as any;
    if (presentation === "tab") {
      router.push(target);
    } else {
      router.replace(target);
    }
  };

  // Quick Add lives as a sheet on the origin screen, not a route — so flag the
  // draft for pick-up and return there: back to the group when pushed over it,
  // or over to Home (which hosts a Quick Add sheet) from the standalone tab.
  const handleChooseQuickAdd = () => {
    setPickerOpen(false);
    setPendingQuickAdd(true);
    if (presentation === "pushed" && router.canGoBack()) {
      router.back();
    } else if (presentation === "pushed" && groupId) {
      router.replace(`/groups/${groupId}` as any);
    } else {
      router.replace("/(tabs)/(home)" as any);
    }
  };

  // Permission still resolving on first mount.
  if (!permission) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} />;
  }

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
              Camera access needed
            </Text>
            <Text className="text-secondary-950 text-center">
              Ambagan needs your camera to scan a receipt.
            </Text>
          </VStack>
          <VStack className="w-full gap-y-2">
            <FormButton
              text="Grant Camera Access"
              onPress={() =>
                permission.canAskAgain
                  ? requestPermission()
                  : Linking.openSettings()
              }
            />
            <FormButton
              variant="outline"
              text={
                scanning ? "Reading receipt…" : "Upload Receipt from Photos"
              }
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
      {isFocused && (
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
              className={`h-14 w-14 items-center justify-center rounded-full active:opacity-60 ${
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
              className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 active:opacity-60"
            >
              <Box className="h-16 w-16 rounded-full bg-white" />
            </Pressable>

            <Pressable
              onPress={handleUploadReceipt}
              disabled={scanning}
              accessibilityLabel="Upload receipt from Photos"
              className="h-14 w-14 items-center justify-center rounded-full bg-white/15 active:opacity-60"
            >
              <ImageUp size={24} color="#fff" />
            </Pressable>
          </HStack>
        </VStack>
      </SafeAreaView>

      {/* Blocks the camera controls while the receipt is being read. */}
      {scanning && (
        <Box
          className="items-center justify-center bg-black/70"
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

      <NewExpensePickerSheet
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          // Dismissed without choosing a flow — drop the draft so a later normal
          // entry into the Custom form doesn't seed from this stale scan.
          clearScanDraft();
        }}
        onQuickAdd={handleChooseQuickAdd}
        onCustom={handleChooseCustom}
      />
    </Box>
  );
}
