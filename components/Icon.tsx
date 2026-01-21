import { LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'react-native';

// Example mapping. Extend this as needed.
const tailwindColorMap: Record<string, string> = {
  'text-primary-400': '#3B82F6',
  'text-secondary-950': '#0F172A',
  'text-inherit': 'inherit'
  // Add more mappings as needed
};

export default function Icon({
  as,
  color,
  size,
  className
}: {
  as: LucideIcon;
  color?: string;
  size?: number;
  className?: string;
}) {
  const colorScheme = useColorScheme();
  const IconComponent = as;

  // Resolve color: color prop > className > fallback
  let resolvedColor = color;
  if (!resolvedColor && className) {
    // Find the first tailwind color class in className
    const colorClass = className.split(' ').find((c) => c.startsWith('text-'));
    if (colorClass && tailwindColorMap[colorClass]) {
      resolvedColor = tailwindColorMap[colorClass];
    }
  }
  if (!resolvedColor) {
    resolvedColor = colorScheme === 'dark' ? 'black' : 'white';
  }

  return <IconComponent color={resolvedColor} {...{ size: size ?? 24 }} />;
}
