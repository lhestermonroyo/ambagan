import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Box } from "./ui/box";
import { HStack } from "./ui/hstack";

const StepperProgress = ({
  currentStep,
  steps
}: {
  currentStep: number;
  steps: number;
}) => {
  return (
    <HStack className="gap-x-2">
      {[...Array(steps)].map((_, index) => (
        <Box
          key={index}
          className={cn(
            "rounded-lg h-2 flex-1",
            currentStep > index ? "bg-primary-400" : "bg-secondary-500"
          )}
        />
      ))}
    </HStack>
  );
};

export default StepperProgress;
