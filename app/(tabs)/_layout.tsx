import { HapticTab } from '@/components/haptic-tab';
import HomeHeader from '@/components/HomeHeader';
import Icon from '@/components/Icon';
import TabButton from '@/components/TabButton';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Home, ListCheck, Plus, UserCircle, Users } from 'lucide-react-native';
import React from 'react';

function CreateTabButton(props: BottomTabBarButtonProps) {
  const { onPress, accessibilityState, accessibilityLabel, testID } = props;
  const isActive = props['aria-selected'];

  return (
    <VStack className="items-center justify-center gap-y-2 top-[-32]">
      <Button
        className="rounded-full h-[64] w-[64]"
        onPress={onPress}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel || 'Create'}
        testID={testID}
      >
        <Icon as={Plus} size={32} />
      </Button>
      <Text
        size="sm"
        className={isActive ? 'text-primary-400' : 'text-secondary-950'}
      >
        Add Expense
      </Text>
    </VStack>
  );
}

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
            headerShown: true,
            header: (props) => {
              return <HomeHeader {...props} />;
            },
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
          name="add-expense/index"
          options={{
            tabBarButton: (props) => <CreateTabButton {...props} />
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
      </Tabs>
    </View>
  );
}
