import { HapticTab } from '@/components/haptic-tab';
import TabButton from '@/components/TabButton';
import { View } from '@/components/ui/view';
import { Tabs } from 'expo-router';
import { Home, ListCheck, UserCircle, Users } from 'lucide-react-native';
import React from 'react';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: 'red',
          tabBarStyle: {
            backgroundColor: '#fff',
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
              <TabButton {...props} label="Home" icon={Home} />
            )
          }}
        />

        <Tabs.Screen
          name="groups/index"
          options={{
            tabBarButton: (props) => (
              <TabButton {...props} label="Groups" icon={Users} />
            )
          }}
        />
        <Tabs.Screen
          name="activity/index"
          options={{
            title: 'Activity',
            tabBarButton: (props) => (
              <TabButton {...props} label="Activity" icon={ListCheck} />
            )
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: 'Profile',
            tabBarButton: (props) => (
              <TabButton {...props} label="Profile" icon={UserCircle} />
            )
          }}
        />
        <Tabs.Screen
          name="groups/create/index"
          options={{
            href: null,
            title: 'Create Group',
            tabBarStyle: { display: 'none' }
          }}
        />
        <Tabs.Screen
          name="home/add-expense/index"
          options={{
            href: null,
            title: 'Add Expense',
            tabBarStyle: { display: 'none' }
          }}
        />
      </Tabs>
    </View>
  );
}
