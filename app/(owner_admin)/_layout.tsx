import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIndustryColor, useDashboardCounters } from '../../src/store/selectors';
import { View, Text } from 'react-native';

export default function OwnerAdminLayout() {
  const insets = useSafeAreaInsets();
  const color = useIndustryColor();
  const counters = useDashboardCounters();

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
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color: c }) => <Ionicons name="home" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color: c }) => (
            <View>
              <Ionicons name="clipboard" size={22} color={c} />
              {counters.needsReview > 0 && (
                <View className="absolute -top-1 -right-2 h-4 min-w-4 rounded-full bg-red-500 items-center justify-center px-1">
                  <Text className="text-white" style={{ fontSize: 9 }}>{counters.needsReview}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sites"
        options={{
          title: 'Sites',
          tabBarIcon: ({ color: c }) => <Ionicons name="location" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color: c }) => <Ionicons name="people" size={22} color={c} />,
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
