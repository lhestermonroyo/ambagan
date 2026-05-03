import { HapticTab } from "@/components/haptic-tab";
import TabButton from "@/components/TabButton";
import { View } from "@/components/ui/view";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#3B82F6",
          tabBarInactiveTintColor: "red",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0,
            height: 85,
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
          name="activities"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Activities" />
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
