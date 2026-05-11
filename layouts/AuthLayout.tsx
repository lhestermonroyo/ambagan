import Logo from "@/components/Logo";
import { Box } from "@/components/ui/box";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="px-4 py-10 gap-y-10">
            <Logo type="auth" />

            <VStack>
              <Text size="3xl" bold>
                {title}
              </Text>
              {subtitle && (
                <Text className="text-xl text-secondary-950">{subtitle}</Text>
              )}
            </VStack>

            {children}
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
      {footer && (
        <Box className="w-full justify-center items-center px-4">{footer}</Box>
      )}
    </SafeAreaView>
  );
}
