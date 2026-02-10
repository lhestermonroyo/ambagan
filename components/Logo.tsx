import { HandCoins } from 'lucide-react-native';
import { Box } from './ui/box';
import { Text } from './ui/text';
import { VStack } from './ui/vstack';

type LogoProps = {
  type?: 'splash' | 'auth' | 'nav';
};

const color = '#3B82F6';

export default function Logo({ type = 'splash' }: LogoProps) {
  if (type === 'splash') {
    return (
      <VStack className="gap-y-2 justify-center items-center">
        <Box className="justify-center items-center bg-primary-0 border-secondary-400 rounded-xl w-24 h-24">
          <HandCoins size={56} color={color} />
        </Box>
        <Text bold className="text-white text-center" size="3xl">
          Ambagan PH
        </Text>
      </VStack>
    );
  }

  if (type === 'auth') {
    return (
      <VStack className="gap-y-2 justify-center items-center">
        <Box className="justify-center items-center bg-primary-50 border-secondary-400 rounded-xl w-20 h-20">
          <HandCoins size={48} color={color} />
        </Box>
        <Text bold className="text-inherit text-center" size="2xl">
          Ambagan{' '}
          <Text bold className="text-primary-400" size="2xl">
            PH
          </Text>
        </Text>
      </VStack>
    );
  }

  return (
    <Box className="justify-center items-center bg-primary-50 border-secondary-400 rounded-xl w-10 h-10">
      <HandCoins size={24} color={color} />
    </Box>
  );
}
