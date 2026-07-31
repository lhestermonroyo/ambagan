import { getPrimaryHex } from "@/utils/getColorHex";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, useColorScheme } from "react-native";

type AppDatePickerProps = {
  /** The currently selected day. */
  value: Date;
  /** Fired when the user taps a day. */
  onChange: (date: Date) => void;
};

/**
 * The app's inline calendar, used inside the date sheets on the expense forms,
 * the recurrence sheet and the stats date-range sheet.
 *
 * On iOS this is the real SwiftUI `DatePicker` in its `.graphical` style via
 * `@expo/ui`, so it picks up the system calendar look (including iOS 26). On
 * Android it falls back to the community picker's inline display, which is the
 * Material calendar. Callers only ever supply a value and a change handler —
 * the brand tint and light/dark variant are handled here so every calendar in
 * the app matches.
 */
export default function AppDatePicker({ value, onChange }: AppDatePickerProps) {
  const colorScheme = useColorScheme();
  // `useColorScheme()` can also return "unspecified"/null; both pickers want a
  // concrete variant, so treat anything but dark as light.
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const accent = getPrimaryHex("text-primary-400", scheme);

  if (Platform.OS === "ios") {
    return (
      // Size to SwiftUI's own layout rather than the parent's — the call sites
      // are a mix of shrink-wrapped and full-width sheet containers, and the
      // graphical picker is taller in months that span six week rows.
      <Host matchContents colorScheme={scheme} seedColor={accent}>
        <DatePicker
          selection={value}
          displayedComponents={["date"]}
          onDateChange={onChange}
          modifiers={[datePickerStyle("graphical"), labelsHidden()]}
        />
      </Host>
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="inline"
      themeVariant={scheme}
      accentColor={accent}
      onChange={(_, date) => {
        if (date) onChange(date);
      }}
    />
  );
}
