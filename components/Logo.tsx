import { HandCoins } from 'lucide-react-native';
import { Box } from './ui/box';
import { Text } from './ui/text';
import { VStack } from './ui/vstack';

type LogoProps = {
  type: 'splash' | 'nav';
};

export default function Logo({ type }: { type?: LogoProps }) {
  return (
    <VStack className="gap-y-2 justify-center items-center">
      <Box className="justify-center items-center bg-primary-0 border-secondary-400 rounded-xl w-24 h-24 shadow-md">
        <HandCoins size={56} className="text-primary-400" />
      </Box>
      <Text className="text-inherit text-center font-bold" size="3xl">
        Ambagan{' '}
        <Text className="text-primary-400 font-bold" size="3xl">
          PH
        </Text>
      </Text>
    </VStack>
  );
}
