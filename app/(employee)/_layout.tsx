import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIndustryColor } from '../../src/store/selectors';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useTheme } from '../../src/providers/ThemeProvider';
import { CommonActions } from '@react-navigation/native';

export default function EmployeeLayout() {
  const insets = useSafeAreaInsets();
  const color = useIndustryColor();
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

  // Role guard: only employee can access employee routes
  if (state.role !== 'employee') {
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
