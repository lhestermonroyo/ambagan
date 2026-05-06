import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
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
    ? getSecondaryHex("text-secondary-0")
    : getPrimaryHex("text-primary-400");

  let icon: JSX.Element | null = null;
  switch (props.label) {
    case "Overview":
      icon = <Wallet size={24} color={color} />;
      break;
    case "Groups":
      icon = <HouseHeart size={24} color={color} />;
      break;
    case "Activities":
      icon = <ArrowLeftRight size={24} color={color} />;
      break;
    case "Profile":
      icon = <CircleUserRound size={24} color={color} />;
      break;
    default:
      null;
  }

  return (
    <VStack className="items-center justify-center">
      <Button
        variant="link"
        className={cn(
          "flex flex-col gap-y-1 w-24 h-16 rounded-full items-center justify-center",
          isActive ? "bg-primary-600" : "bg-transparent"
        )}
        onPress={onPress}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {icon}
        <Text
          size="sm"
          className={cn(isActive ? "text-secondary-0" : "text-primary-400")}
        >
          {label}
        </Text>
      </Button>
    </VStack>
  );
}
