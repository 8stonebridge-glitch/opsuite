import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIndustryColor } from '../../src/store/selectors';

export default function EmployeeLayout() {
  const insets = useSafeAreaInsets();
  const color = useIndustryColor();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f3f4f6',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: color,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="my-day"
        options={{
          title: 'My Day',
          tabBarIcon: ({ color: c }) => <Ionicons name="sunny" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color: c }) => <Ionicons name="clipboard" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: 'Handoff',
          tabBarIcon: ({ color: c }) => <Ionicons name="hand-left" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color: c }) => <Ionicons name="settings" size={22} color={c} />,
        }}
      />
    </Tabs>
  );
}
