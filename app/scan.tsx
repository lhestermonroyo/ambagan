import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { ScanLine, X } from "lucide-react-native";
import { useRef, useState } from "react";
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
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  // Guards against the camera firing onBarcodeScanned repeatedly for the same
  // code while we navigate away.
  const handledRef = useRef(false);
  const colorScheme = useColorScheme() ?? "light";

  const handleClose = () => router.back();

  const handleBarcodeScanned = ({ data }: { data: string }) => {
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

    handledRef.current = true;
    // Reuse the deep-link join flow (auth/onboarding checks + join + routing).
    router.replace(`/join/${token}` as any);
  };

  // Permission still resolving on first mount.
  if (!permission) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} />;
  }

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
              Camera access needed
            </Text>
            <Text className="text-secondary-950 text-center">
              Ambagan needs your camera to scan a group invite QR code.
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
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
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

          <Box className="items-center p-6">
            <Pressable
              onPress={() => setTorch((prev) => !prev)}
              className="px-4 py-2 rounded-full bg-black/50"
            >
              <Text className="text-white">
                {torch ? "Turn off flashlight" : "Turn on flashlight"}
              </Text>
            </Pressable>
          </Box>
        </VStack>
      </SafeAreaView>
    </Box>
  );
}
