import Logo from "./Logo";
import LiquidDots from "./LiquidDots";
import { View } from "./ui/view";
import { VStack } from "./ui/vstack";

const SplashLoading = ({
  loading,
  children
}: {
  loading: boolean;
  children?: React.ReactNode;
}) => {
  if (!loading) {
    return children;
  }

  return (
    <View className="flex-1 justify-center items-center bg-secondary-0">
      <VStack className="items-center gap-y-12">
        <Logo type="splash" />
        <LiquidDots />
      </VStack>
    </View>
  );
};

export default SplashLoading;
