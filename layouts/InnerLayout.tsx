import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
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
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <Box className="px-4 py-2">
          <HStack className="items-center justify-between">
            <HStack className="items-center flex-1">
              <Button variant="link" className="rounded-full" onPress={onBack}>
                <Icon as="arrow-back-ios" className="text-secondary-950" />
              </Button>
              <Text bold className="flex-1 text-xl">
                {title}
              </Text>
            </HStack>
            {actions && (
              <HStack className="gap-x-4">
                {actions.map((item, index) => (
                  <Fragment key={index}>{item}</Fragment>
                ))}
              </HStack>
            )}
          </HStack>
        </Box>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
