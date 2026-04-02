import { HandCoins } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { Box } from "./ui/box";
import { HStack } from "./ui/hstack";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

type LogoProps = {
  type?: "splash" | "auth" | "nav";
};

export default function Logo({ type = "splash" }: LogoProps) {
  const theme = useColorScheme();
  const color = theme === "dark" ? "#3B82F6" : "#2563EB";

  if (type === "splash") {
    return (
      <VStack className="gap-y-2 justify-center items-center">
        <Box className="justify-center items-center bg-primary-0 rounded-2xl w-24 h-24">
          <HandCoins size={56} color={color} />
        </Box>
        <Text bold className="text-background-0 text-center" size="3xl">
          Ambagan PH
        </Text>
      </VStack>
    );
  }

  if (type === "auth") {
    return (
      <HStack className="gap-x-2 justify-center items-center">
        <Box className="justify-center items-center bg-primary-50 rounded-2xl w-12 h-12">
          <HandCoins size={28} color={color} />
        </Box>
        <Text bold className="text-center" size="2xl">
          Ambagan{" "}
          <Text bold className="text-primary-400" size="2xl">
            PH
          </Text>
        </Text>
      </HStack>
    );
  }

  return (
    <Box className="justify-center items-center bg-primary-50 border-secondary-400 border-2 rounded-xl w-10 h-10">
      <HandCoins size={24} color={color} />
    </Box>
  );
}
