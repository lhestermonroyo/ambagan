import { HapticTab } from "@/components/haptic-tab";
import TabButton from "@/components/TabButton";
import { View } from "@/components/ui/view";
import { getSecondaryHex } from "@/utils/getColorHex";
import { Tabs } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: "fade",
          tabBarActiveTintColor: "#3B82F6",
          tabBarInactiveTintColor: "red",
          tabBarStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? getSecondaryHex("text-secondary-100", colorScheme)
                : getSecondaryHex("text-secondary-0", colorScheme),
            borderTopWidth: 0,
            boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.1)",
            height: 85,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 25
          },
          tabBarButton: HapticTab
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Overview" />
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Groups" />
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Friends" />
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Profile" />
          }}
        />
      </Tabs>
    </View>
  );
}
