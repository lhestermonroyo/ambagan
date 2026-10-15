import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useState } from "react";
import { TextInput, useColorScheme } from "react-native";

export default function ExpenseDescriptionField({
  value,
  onChangeText,
  placeholder,
  errorMessage
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  errorMessage?: string;
}) {
  const scheme = useColorScheme() ?? "light";
  const [height, setHeight] = useState(24);
  return (
    <VStack className="gap-y-1">
      <Box
        className={`bg-secondary-100 rounded-xl px-4 py-3 ${errorMessage ? "border border-error-300" : ""}`}
      >
        <Text className="text-xs uppercase tracking-widest text-secondary-950 mb-2">
          Description
        </Text>
        <TextInput
          accessibilityLabel="Description"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={scheme === "dark" ? "#969696" : "#737373"}
          multiline
          scrollEnabled={false}
          autoCapitalize="none"
          className="text-base  text-typography-950"
          selectionColor={getPrimaryHex("text-primary-500", scheme)}
          style={{
            fontFamily: "GoogleSans-Regular",
            padding: 0,
            lineHeight: 24,
            height,
            textAlignVertical: "top"
          }}
          onContentSizeChange={(event) =>
            setHeight(Math.max(24, event.nativeEvent.contentSize.height))
          }
        />
      </Box>
      {!!errorMessage && (
        <Text className="text-sm text-error-500">{errorMessage}</Text>
      )}
    </VStack>
  );
}
