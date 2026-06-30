import { Text } from "@/components/ui/text";
import { CloudOff } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Shown when the device is online but reads are timing out (slow/hung network).
 * Amber, distinct from the blue true-offline banner — telling a user on WiFi
 * they're "offline" would be misleading. The data they see is the cached copy.
 */
export default function SlowConnectionBanner() {
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.banner, { paddingTop: top }]}>
      <CloudOff size={14} color="white" />
      <Text style={styles.text}>Slow connection — showing saved data</Text>
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
    backgroundColor: "#D97706",
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
