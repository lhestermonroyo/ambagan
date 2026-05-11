import { useColorScheme } from "react-native";
import { Image } from "./ui/image";

const COIN = "#F59E0B";
const COIN_RING = "rgba(255,255,255,0.25)";
const PURPLE = "#8B5CF6";
const PURPLE_MUTED = "#DDD6FE";
const FONT = "GoogleSans-Bold";

type LogoProps = {
  type?: "splash" | "auth" | "nav";
};

export default function Logo({ type = "splash" }: LogoProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";

  if (type === "splash") {
    return (
      <Image
        source={require("@/assets/images/dark-md.png")}
        className="w-48 h-16"
        alt="logo"
        resizeMode="contain"
      />
    );
  }

  if (isDark) {
    return (
      <Image
        source={require("@/assets/images/dark-md.png")}
        className="w-40 h-12"
        alt="logo"
        resizeMode="contain"
      />
    );
  } else {
    return (
      <Image
        source={require("@/assets/images/light-md.png")}
        className="w-40 h-12"
        alt="logo"
        resizeMode="contain"
      />
    );
  }
}
