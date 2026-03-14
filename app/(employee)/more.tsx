import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { authClient } from '../../src/lib/auth-client';
import { useCurrentName, useMyTeam, useIndustryColor, useCheckInStats, useAvailability } from '../../src/store/selectors';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { LeaveRequestSheet } from '../../src/components/availability/LeaveRequestSheet';
import { AvailabilityHistory } from '../../src/components/availability/AvailabilityHistory';

export default function EmployeeMoreScreen() {
  const { state, dispatch } = useApp();
  const name = useCurrentName();
  const team = useMyTeam();
  const color = useIndustryColor();
  const stats = useCheckInStats();
  const availability = useAvailability();
  const router = useRouter();
  const [showLeaveSheet, setShowLeaveSheet] = useState(false);

  const completedCount = state.tasks.filter(
    (t) => t.assigneeId === state.userId && (t.status === 'Completed' || t.status === 'Verified')
  ).length;

  const myRecords = availability.filter((r) => r.memberId === state.userId);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 gap-3">
          <Card className="items-center py-6">
            <Avatar name={name} color={team?.color || color} size="lg" />
            <Text className="text-lg font-bold text-gray-900 mt-3">{name}</Text>
            <Text className="text-sm text-gray-400">{team?.name || 'Team'}</Text>
          </Card>

          {/* Availability Section */}
          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Availability
            </Text>
            <Pressable
              onPress={() => setShowLeaveSheet(true)}
              className="flex-row items-center gap-3 py-3 border-b border-gray-100"
            >
              <Ionicons name="airplane" size={18} color="#3b82f6" />
              <Text className="text-sm text-gray-700 flex-1">Request Leave</Text>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </Pressable>
            <View className="mt-2">
              <AvailabilityHistory records={myRecords} />
            </View>
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Org Policy
            </Text>
            <SettingRow icon="pause-circle" label="Stalled alert after" value={`${state.orgSettings.noChangeAlertWorkdays} workdays`} />
            <SettingRow icon="refresh-circle" label="Rework escalation after" value={`${state.orgSettings.reworkAlertCycles} cycles`} last />
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Personal
            </Text>
            <SettingRow icon="flame" label="Current Streak" value={`${stats.currentStreak} days`} />
            <SettingRow icon="checkmark-done" label="Tasks Completed" value={String(completedCount)} />
            <SettingRow icon="business" label="Organization" value={state.onboarding.orgName} last />
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              App Settings
            </Text>
            <SettingRow icon="notifications-outline" label="Notifications" value="Coming soon" />
            <SettingRow icon="color-palette-outline" label="Theme" value="Light" />
            <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" last />
          </Card>

          <Button
            title="Sign Out"
            variant="outline"
            onPress={() => {
              Alert.alert('Sign Out?', 'Are you sure you want to sign out?', [
                { text: 'Cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    if (!state.isDemo) {
                      await authClient.signOut();
                    }
                    dispatch({ type: 'SIGN_OUT' });
                    router.replace('/(auth)/sign-in');
                  },
                },
              ]);
            }}
          />
        </View>
      </ScrollView>

      <LeaveRequestSheet visible={showLeaveSheet} onClose={() => setShowLeaveSheet(false)} />
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
      className={`flex-row gap-3 py-3 ${last ? '' : 'border-b border-gray-100'}`}
      style={{ alignItems: 'flex-start' }}
    >
      <Ionicons name={icon as any} size={18} color="#9ca3af" />
      <Text className="text-sm text-gray-700 flex-1" style={{ paddingRight: 8, minWidth: 0 }}>
        {label}
      </Text>
      <Text
        className="text-sm text-gray-400 text-right"
        style={{ maxWidth: '46%', flexShrink: 1, flexWrap: 'wrap' }}
      >
        {value}
      </Text>
    </View>
  );
}
