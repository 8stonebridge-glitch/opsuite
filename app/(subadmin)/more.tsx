import { View, Text, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { authClient } from '../../src/lib/auth-client';
import { useCurrentName, useMyTeam, useIndustryColor } from '../../src/store/selectors';
import { ThemeSwitcher } from '../../src/components/ui/ThemeSwitcher';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';

export default function SubAdminMoreScreen() {
  const { state, dispatch } = useApp();
  const name = useCurrentName();
  const team = useMyTeam();
  const color = useIndustryColor();
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 gap-3">
          <Card className="items-center py-6">
            <Avatar name={name} color={team?.color || color} size="lg" />
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3">{name}</Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500">{team?.name || 'Team'} Lead</Text>
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Org Policy
            </Text>
            <SettingRow icon="pause-circle" label="Stalled alert after" value={`${state.orgSettings.noChangeAlertWorkdays} workdays`} />
            <SettingRow icon="refresh-circle" label="Rework escalation after" value={`${state.orgSettings.reworkAlertCycles} cycles`} last />
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Team
            </Text>
            <SettingRow icon="people" label="Team" value={team?.name || '-'} />
            <SettingRow icon="person" label="Members" value={String(team?.members.length || 0)} />
            <SettingRow icon="business" label="Organization" value={state.onboarding.orgName} last />
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              App Settings
            </Text>
            <SettingRow icon="notifications-outline" label="Notifications" value="Coming soon" last />
          </Card>

          <Card>
            <ThemeSwitcher />
          </Card>

          <Card>
            <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" last />
          </Card>

          <Button
            title="Sign Out"
            variant="outline"
            onPress={() => {
              const doSignOut = async () => {
                dispatch({ type: 'SIGN_OUT' });
                if (!state.isDemo) {
                  try { await authClient.signOut(); } catch (e) { console.warn('Sign-out error:', e); }
                }
                router.replace('/(auth)/sign-in');
              };

              if (Platform.OS === 'web') {
                if (window.confirm('Are you sure you want to sign out?')) {
                  void doSignOut();
                }
              } else {
                Alert.alert('Sign Out?', 'Are you sure you want to sign out?', [
                  { text: 'Cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: () => void doSignOut() },
                ]);
              }
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  last,
}: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row gap-3 py-3 ${last ? '' : 'border-b border-gray-100 dark:border-gray-800'}`}
      style={{ alignItems: 'flex-start' }}
    >
      <Ionicons name={icon as any} size={18} color="#9ca3af" />
      <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1" style={{ paddingRight: 8, minWidth: 0 }}>
        {label}
      </Text>
      <Text
        className="text-sm text-gray-400 dark:text-gray-500 text-right"
        style={{ maxWidth: '46%', flexShrink: 1, flexWrap: 'wrap' }}
      >
        {value}
      </Text>
    </View>
  );
}
