import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Text } from "@/components/ui/text";
import { Fragment } from "react";

export default function TabLayout({
  children,
  title,
  actions
}: {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode[];
}) {
  return (
    <KeyboardAvoidingView className="bg-background-0 flex-1" behavior="padding">
      <Box className="sticky top-0 pb-4 px-4 pt-20">
        <HStack className="items-center">
          <Text bold className="flex-1 text-3xl">
            {title}
          </Text>
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
