import { useColorScheme } from "react-native";
import { Image } from "./ui/image";

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
