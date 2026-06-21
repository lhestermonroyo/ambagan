import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Text } from "@/components/ui/text";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment } from "react";
import { Platform } from "react-native";

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
    <Fragment>
      <KeyboardAvoidingView
        className="flex-1 bg-background-0"
        behavior="padding"
      >
        <Box
          className={cn(
            "sticky top-0 px-4 pb-2",
            Platform.OS === "android" ? "pt-[4rem]" : "pt-[5.5rem]"
          )}
        >
          <HStack className="items-center">
            <Text bold className="flex-1 text-3xl">
              {title}
            </Text>
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
    </Fragment>
  );
}
