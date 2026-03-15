import { Box } from "./ui/box";
import { Text } from "./ui/text";

export default function LoadingWrapper({
  isLoading,
  text = "Loading, please wait...",
  children
}: {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <Box className="p-4">
        <Text className="text-center text-secondary-950">{text}</Text>
      </Box>
    );
  }

  return children;
}
