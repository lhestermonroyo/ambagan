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
          name="home/index"
          options={{
            tabBarButton: (props) => (
              <TabButton {...props} label="Home" icon="home" />
            )
          }}
        />

        <Tabs.Screen
          name="groups/index"
          options={{
            tabBarButton: (props) => (
              <TabButton {...props} label="Groups" icon="groups" />
            )
          }}
        />
        <Tabs.Screen
          name="activity/index"
          options={{
            title: "Activity",
            tabBarButton: (props) => (
              <TabButton {...props} label="Activity" icon="checklist" />
            )
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            tabBarButton: (props) => (
              <TabButton {...props} label="Profile" icon="account-circle" />
            )
          }}
        />
        <Tabs.Screen
          name="groups/create/index"
          options={{
            href: null,
            title: "Create Group",
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="home/add-expense/index"
          options={{
            href: null,
            title: "Add Expense",
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="groups/[id]/index"
          options={{
            href: null,
            title: "Group Details",
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="groups/[id]/edit/index"
          options={{
            href: null,
            title: "Edit Group",
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="groups/[id]/members/index"
          options={{
            href: null,
            title: "Edit Group",
            tabBarStyle: { display: "none" }
          }}
        />
      </Tabs>
    </View>
  );
}
