import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { useAuth } from '../../src/lib/clerk';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCurrentName, useMyTeam, useIndustryColor, useCheckInStats, useAvailability } from '../../src/store/selectors';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { getToday, getNowISO } from '../../src/utils/date';
import { uid } from '../../src/utils/id';
import { useTheme } from '../../src/providers/ThemeProvider';
import { ThemeSwitcher } from '../../src/components/ui/ThemeSwitcher';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { LeaveRequestSheet } from '../../src/components/availability/LeaveRequestSheet';
import { AvailabilityHistory } from '../../src/components/availability/AvailabilityHistory';

export default function EmployeeMoreScreen() {
  const { state, dispatch } = useApp();
  const { signOut: clerkSignOut } = useAuth();
  const name = useCurrentName();
  const team = useMyTeam();
  const color = useIndustryColor();
  const stats = useCheckInStats();
  const availability = useAvailability();
  const router = useRouter();
  const [showLeaveSheet, setShowLeaveSheet] = useState(false);
  const [isSubmittingSick, setIsSubmittingSick] = useState(false);
  const { isDark } = useTheme();
  const { authEnabled } = useBackendAuth();
  const isBackendMode = !state.isDemo && authEnabled;
  const createAvailabilityRequest = useMutation(api.availability.createRequest);
  const today = getToday();

  const hasAvailabilityToday = state.availability.some(
    (r) =>
      r.memberId === state.userId &&
      r.startDate <= today &&
      r.endDate >= today &&
      r.status !== 'cancelled' &&
      r.status !== 'rejected'
  );

  const handleReportSick = async () => {
    if (isBackendMode) {
      setIsSubmittingSick(true);
      try {
        await createAvailabilityRequest({
          type: 'sick',
          startDate: today,
          endDate: today,
          notes: 'Reported sick',
        });
      } finally {
        setIsSubmittingSick(false);
      }
      return;
    }

    if (!state.userId || !state.activeWorkspaceId) return;
    dispatch({
      type: 'REQUEST_AVAILABILITY',
      record: {
        id: uid(),
        organizationId: state.activeWorkspaceId,
        memberId: state.userId,
        type: 'sick',
        status: 'pending',
        startDate: today,
        endDate: today,
        notes: 'Reported sick',
        requestedById: state.userId,
        approvedById: null,
        createdAt: getNowISO(),
        approvedAt: null,
      },
    });
  };

  const completedCount = state.tasks.filter(
    (t) => t.assigneeId === state.userId && (t.status === 'Completed' || t.status === 'Verified')
  ).length;

  const myRecords = availability.filter((r) => r.memberId === state.userId);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 gap-3">
          <Card className="items-center py-6">
            <Avatar name={name} color={team?.color || color} size="lg" />
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3">{name}</Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500">{team?.name || 'Team'}</Text>
          </Card>

          {/* Availability Section */}
          <Card>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Availability
            </Text>
            {!hasAvailabilityToday && (
              <Pressable
                onPress={() => void handleReportSick()}
                disabled={isSubmittingSick}
                className="flex-row items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800"
              >
                <Ionicons name="medkit" size={18} color="#ef4444" />
                <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {isSubmittingSick ? 'Reporting Sick...' : 'Report Sick Today'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#4b5563' : '#d1d5db'} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowLeaveSheet(true)}
              className="flex-row items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800"
            >
              <Ionicons name="airplane" size={18} color="#3b82f6" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">Request Leave</Text>
              <Ionicons name="chevron-forward" size={16} color={isDark ? '#4b5563' : '#d1d5db'} />
            </Pressable>
            <View className="mt-2">
              <AvailabilityHistory records={myRecords} />
            </View>
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
              Personal
            </Text>
            <SettingRow icon="flame" label="Current Streak" value={`${stats.currentStreak} days`} />
            <SettingRow icon="checkmark-done" label="Tasks Completed" value={String(completedCount)} />
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
                  try { await clerkSignOut(); } catch (e) { console.warn('Sign-out error:', e); }
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
