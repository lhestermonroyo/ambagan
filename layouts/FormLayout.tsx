import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { Fragment } from "react";

export default function FormLayout({
  children,
  title,
  onBack,
  footer
}: {
  children: React.ReactNode;
  title: string;
  onBack: () => void;
  footer: React.ReactNode[];
}) {
  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView
        className="bg-background-0 flex-1"
        behavior="padding"
      >
        <Box className="px-4 py-2">
          <HStack className="items-center justify-between">
            <Button variant="link" className="rounded-full" onPress={onBack}>
              <Icon as="arrow-back-ios" className="text-secondary-950" />
            </Button>
            <Text bold className="flex-1 text-xl">
              {title}
            </Text>
          </HStack>
        </Box>
        {children}
        <Box className="items-center justify-center p-4">
          <HStack className="gap-x-2">
            {footer.map((item, index) => (
              <Fragment key={index}>{item}</Fragment>
            ))}
          </HStack>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
