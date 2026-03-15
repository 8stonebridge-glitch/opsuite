import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIndustryColor, useDashboardCounters } from '../../src/store/selectors';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useTheme } from '../../src/providers/ThemeProvider';
import { CommonActions } from '@react-navigation/native';

export default function SubAdminLayout() {
  const insets = useSafeAreaInsets();
  const color = useIndustryColor();
  const counters = useDashboardCounters();
  const { state } = useApp();
  const { authEnabled, isLoaded, isSignedIn } = useBackendAuth();
  const { isDark } = useTheme();

  if (!state.isAuthenticated && authEnabled && isLoaded && isSignedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#030712' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#059669" />
      </SafeAreaView>
    );
  }

  if (!state.isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Role guard: only subadmin can access subadmin routes
  if (state.role !== 'subadmin') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#030712' : '#fff',
          borderTopColor: isDark ? '#1f2937' : '#f3f4f6',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: color,
        tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
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
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: 'tasks',
                params: { screen: 'index' },
              })
            );
          },
        })}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'Team',
          tabBarIcon: ({ color: c }) => <Ionicons name="people" size={22} color={c} />,
        }}
      />
      <Tabs.Screen
        name="check-ins"
        options={{
          title: 'Check-ins',
          tabBarIcon: ({ color: c }) => <Ionicons name="notifications" size={22} color={c} />,
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
