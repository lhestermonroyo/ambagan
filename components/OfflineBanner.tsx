import { Text } from "@/components/ui/text";
import { WifiOff } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OfflineBanner() {
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.banner, { paddingTop: top + 4 }]}>
      <WifiOff size={13} color="white" />
      <Text style={styles.text}>No internet connection.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 6
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600"
  }
});
