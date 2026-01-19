import { LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'react-native';

export default function Icon({
  name,
  size
}: {
  name: LucideIcon;
  size?: number;
}) {
  const colorScheme = useColorScheme();
  const IconComponent = name;

  return (
    <IconComponent
      color={colorScheme === 'dark' ? 'black' : 'white'}
      {...{ size: size ?? 24 }}
    />
  );
}
