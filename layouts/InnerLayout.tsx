import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Text } from "@/components/ui/text";
import { Fragment } from "react";

export default function InnerLayout({
  children,
  title,
  onBack,
  actions
}: {
  children: React.ReactNode;
  title: string;
  onBack: () => void;
  actions?: React.ReactNode[];
}) {
  return (
    <KeyboardAvoidingView className="bg-background-0 flex-1" behavior="padding">
      <Box className="sticky top-0 pb-4 px-4 pt-20">
        <HStack className="items-center">
          <HStack className="items-center flex-1">
            <Button variant="link" className="rounded-full" onPress={onBack}>
              <Icon as="arrow-back-ios" className="text-secondary-950" />
            </Button>
            <Text bold className="flex-1 text-xl">
              {title}
            </Text>
          </HStack>
          {actions && (
            <HStack className="gap-x-4 items-center">
              {actions.map((item, index) => (
                <Fragment key={index}>{item}</Fragment>
              ))}
            </HStack>
          )}
        </HStack>
      </Box>
      {children}
    </KeyboardAvoidingView>
  );
}
