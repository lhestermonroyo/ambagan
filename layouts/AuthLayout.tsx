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
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <KeyboardAvoidingView className="flex-1 bg-background-0" behavior="padding">
      <ScrollView>
        <SafeAreaView>
          <VStack className="px-4 gap-y-10">
            <Box className="h-20 items-center justify-center">
              <Logo type="auth" />
            </Box>

            <VStack>
              <Text size="3xl" bold className="text-center">
                {title}
              </Text>
              {subtitle && (
                <Text className="text-center text-lg text-secondary-950">
                  {subtitle}
                </Text>
              )}
            </VStack>

            {children}
          </VStack>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
