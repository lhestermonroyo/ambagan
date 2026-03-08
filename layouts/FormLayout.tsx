import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
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
    <KeyboardAvoidingView className="bg-background-0 flex-1" behavior="padding">
      <Box className="sticky top-0 px-4 pb-4 pt-20">
        <HStack className="items-center justify-between">
          <Button variant="link" className="rounded-full" onPress={onBack}>
            <Icon as="arrow-back-ios" className="text-secondary-950" />
          </Button>
          <Text bold className="flex-1 text-xl">
            {title}
          </Text>
          <Box className="w-6" />
        </HStack>
      </Box>
      {children}
      <Box className="h-24 items-center justify-center sticky bottom-0 px-4 pb-20">
        <Box className="h-8" />
        <HStack className="gap-x-2 pt-4">
          {footer.map((item, index) => (
            <Fragment key={index}>{item}</Fragment>
          ))}
        </HStack>
        <Box className="h-12" />
      </Box>
    </KeyboardAvoidingView>
  );
}
