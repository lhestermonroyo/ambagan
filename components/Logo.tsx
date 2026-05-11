import { useColorScheme } from "react-native";
import Svg, { Circle, Text as SvgText, TSpan } from "react-native-svg";
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
      <Svg width={220} height={136} viewBox="0 0 220 136">
        {/* Coin */}
        <Circle cx={110} cy={40} r={32} fill={COIN} />
        <Circle
          cx={110}
          cy={40}
          r={25}
          fill="none"
          stroke={COIN_RING}
          strokeWidth={1.5}
        />
        <SvgText
          x={110}
          y={52}
          textAnchor="middle"
          fill="white"
          fontSize={28}
          fontFamily={FONT}
        >
          ₱
        </SvgText>

        {/* Wordmark */}
        <SvgText
          x={110}
          y={116}
          textAnchor="middle"
          fontSize={38}
          fontFamily={FONT}
        >
          <TSpan fill="white">ambagan</TSpan>
          <TSpan fill={PURPLE_MUTED}>ph</TSpan>
        </SvgText>

        {/* Tagline dot */}
        <Circle cx={110} cy={128} r={3} fill={PURPLE_MUTED} />
      </Svg>
    );
  }

  if (type === "auth") {
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

  // ── Nav / icon-only ────────────────────────────────────────────────────
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Circle
        cx={20}
        cy={20}
        r={19}
        fill={isDark ? "rgba(139,92,246,0.15)" : "#EDE9FE"}
      />
      <Circle cx={20} cy={20} r={15} fill={COIN} />
      <Circle
        cx={20}
        cy={20}
        r={11}
        fill="none"
        stroke={COIN_RING}
        strokeWidth={1.5}
      />
      <SvgText
        x={20}
        y={26}
        textAnchor="middle"
        fill="white"
        fontSize={14}
        fontFamily={FONT}
      >
        ₱
      </SvgText>
    </Svg>
  );
}
