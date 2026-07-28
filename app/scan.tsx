import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import { getPrimaryHex } from "@/utils/getColorHex";
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ImageUp, ScanLine, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Group invite QRs encode `ambagan://join/<token>`. Pull the token out of that
// (or any URL that ends in `join/<token>`) so we can hand off to the existing
// join flow. Returns null for anything that isn't one of our invite codes.
function parseInviteToken(raw: string): string | null {
  const match = raw.match(/join\/([^/?#\s]+)/);
  return match ? match[1] : null;
}

export default function ScanJoinScreen() {
  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Guards against the camera firing onBarcodeScanned repeatedly for the same
  // code while we navigate away.
  const handledRef = useRef(false);
  const colorScheme = useColorScheme() ?? "light";

  const handleClose = () => router.back();

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

  // Reuse the deep-link join flow (auth/onboarding checks + join + routing).
  // Joining hits the server, so bail with the standard offline toast (leaving
  // handledRef unset so the caller can re-scan) when there's no connection.
  const routeToJoin = async (token: string): Promise<boolean> => {
    if (
      !(await ensureOnline(
        "You need an internet connection to join a group. Please try again when you're back online."
      ))
    ) {
      return false;
    }
    handledRef.current = true;
    router.replace(`/join/${token}` as any);
    return true;
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (handledRef.current) return;

    const token = parseInviteToken(data);
    if (!token) {
      // Not one of our invite QRs — warn once, then allow another scan.
      handledRef.current = true;
      toast({
        title: "Not an Ambagan invite",
        description: "That QR code isn't a group invite. Try another.",
        type: "warning"
      });
      setTimeout(() => {
        handledRef.current = false;
      }, 1500);
      return;
    }

    // Block re-entry while the async connectivity check runs so a stream of
    // camera frames can't spam the offline toast; re-arm if we didn't route.
    handledRef.current = true;
    const routed = await routeToJoin(token);
    if (!routed) {
      setTimeout(() => {
        handledRef.current = false;
      }, 1500);
    }
  };

  // Join from a saved/screenshotted invite QR instead of pointing the camera
  // at one. The picked image is decoded with the same QR reader.
  const handleUploadQR = async () => {
    if (handledRef.current || uploading) return;

    // No permission request here on purpose: the picker runs out of process
    // (PHPicker on iOS, the system photo picker on Android), so it hands back
    // only the chosen image and never needs library access of its own.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1
    });
    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (!uri) return;

    setUploading(true);
    try {
      const scans = await scanFromURLAsync(uri, ["qr"]);
      const token = scans
        .map((scan) => parseInviteToken(scan.data))
        .find((t): t is string => !!t);

      if (token) {
        await routeToJoin(token);
        return;
      }

      toast({
        title: "No invite found",
        description:
          "We couldn't find a group invite QR in that image. Try another.",
        type: "warning"
      });
    } catch {
      toast({
        title: "Couldn't read image",
        description: "That image couldn't be scanned. Please try another.",
        type: "error"
      });
    } finally {
      setUploading(false);
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
          <ScanLine
            size={48}
            color={getPrimaryHex("text-primary-500", colorScheme)}
          />
          <VStack className="gap-y-2">
            <Text bold className="text-xl text-center">
              Camera access is off
            </Text>
            <Text className="text-secondary-950 text-center">
              Turn on camera access in Settings to scan a group invite QR code.
              You can also pick a saved QR image from your photos instead.
            </Text>
          </VStack>
          <VStack className="w-full gap-y-2">
            <FormButton
              text="Open Settings"
              onPress={() => Linking.openSettings()}
            />
            <FormButton
              variant="outline"
              text={uploading ? "Reading image…" : "Choose from Photos"}
              onPress={handleUploadQR}
              disabled={uploading}
            />
            <FormButton variant="outline" text="Cancel" onPress={handleClose} />
          </VStack>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <Box className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <VStack className="flex-1">
          <Box className="p-4">
            <Pressable
              onPress={handleClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50 active:opacity-50"
            >
              <X size={22} color="#fff" />
            </Pressable>
          </Box>

          <VStack className="flex-1 items-center justify-center gap-y-6">
            <Box
              className="rounded-3xl border-2 border-white/80"
              style={{ width: 240, height: 240 }}
            />
            <Text className="text-white text-center px-8">
              Point your camera at a group invite QR code to join.
            </Text>
          </VStack>

          <VStack className="items-center gap-y-3 p-6">
            <Pressable
              onPress={handleUploadQR}
              disabled={uploading}
              className="w-full active:opacity-50"
            >
              <HStack className="items-center justify-center gap-x-2 px-4 py-3 rounded-full bg-white/15">
                <ImageUp size={18} color="#fff" />
                <Text className="text-white">
                  {uploading ? "Reading image…" : "Upload QR from Photos"}
                </Text>
              </HStack>
            </Pressable>

            <Pressable
              onPress={() => setTorch((prev) => !prev)}
              className="px-4 py-2 rounded-full bg-black/50 active:opacity-50"
            >
              <Text className="text-white">
                {torch ? "Turn off flashlight" : "Turn on flashlight"}
              </Text>
            </Pressable>
          </VStack>
        </VStack>
      </SafeAreaView>
    </Box>
  );
}
