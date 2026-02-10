import Logo from './Logo';
import { Spinner } from './ui/spinner';
import { View } from './ui/view';
import { VStack } from './ui/vstack';

const SplashLoading = ({
  loading,
  children
}: {
  loading: boolean;
  children: React.ReactNode;
}) => {
  if (!loading) {
    return children;
  }

  return (
    <View className="flex-1 justify-center items-center bg-primary-400">
      <VStack className="gap-y-12">
        <Logo type="splash" />
        <Spinner size="large" className="text-white" />
      </VStack>
    </View>
  );
};

export default SplashLoading;
