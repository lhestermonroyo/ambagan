import { Box } from "./ui/box";
import { Text } from "./ui/text";

export default function LoadingWrapper({
  isLoading,
  text = "Loading, please wait...",
  skeleton,
  children
}: {
  isLoading: boolean;
  text?: string;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return skeleton ?? (
      <Box className="p-4">
        <Text className="text-center text-secondary-950">{text}</Text>
      </Box>
    );
  }

  return children;
}
