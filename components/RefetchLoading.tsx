import { Box } from "lucide-react-native";
import { Spinner } from "./ui/spinner";

export default function RefetchLoading() {
  return (
    <Box className="flex-1 items-center justify-center">
      <Spinner className="bg-background-0" />
    </Box>
  );
}