import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import {
  ArrowLeftRight,
  CircleUserRound,
  HouseHeart,
  Wallet
} from "lucide-react-native";
import { JSX } from "react";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export default function TabButton(
  props: BottomTabBarButtonProps & {
    label: string;
  }
) {
  const { onPress, accessibilityState, accessibilityLabel, testID, label } =
    props;
  const isActive = props["aria-selected"];
  const color = isActive
    ? getPrimaryHex("text-primary-400")
    : getSecondaryHex("text-secondary-950");

  let icon: JSX.Element | null = null;
  switch (props.label) {
    case "Overview":
      icon = <Wallet size={24} color={color} />;
      break;
    case "Groups":
      icon = <HouseHeart size={24} color={color} />;
      break;
    case "Payments":
      icon = <ArrowLeftRight size={24} color={color} />;
      break;
    case "Profile":
      icon = <CircleUserRound size={24} color={color} />;
      break;
    default:
      null;
  }

  return (
    <VStack className="items-center justify-center py-2">
      <Button
        variant="link"
        className="flex flex-col gap-y-1"
        onPress={onPress}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {icon}
        <Text
          size="sm"
          className={isActive ? "text-primary-400" : "text-secondary-950"}
        >
          {label}
        </Text>
      </Button>
    </VStack>
  );
}
