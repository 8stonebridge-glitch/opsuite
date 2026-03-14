import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { authClient } from '../../src/lib/auth-client';
import { useIndustryColor, useTeams, useAllEmployees } from '../../src/store/selectors';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { OrgSwitcher } from '../../src/components/layout/OrgSwitcher';

export default function OwnerMoreScreen() {
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const updateOrgSettings = useMutation(api.orgSettings.update);
  const color = useIndustryColor();
  const teams = useTeams();
  const allEmployees = useAllEmployees();
  const router = useRouter();

  const adjustSetting = async (key: 'noChangeAlertWorkdays' | 'reworkAlertCycles', delta: number) => {
    const current = state.orgSettings[key];
    const newVal = Math.max(1, Math.min(10, current + delta));
    dispatch({ type: 'SET_ORG_SETTINGS', settings: { [key]: newVal } });

    if (!state.isDemo && authEnabled) {
      try {
        await updateOrgSettings({
          organizationId: state.activeWorkspaceId as never,
          [key]: newVal,
        });
      } catch (error) {
        console.warn('Failed to persist operational rules in Convex.', error);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 gap-3">
          <Card className="items-center py-6">
            <Avatar name={state.onboarding.adminName || 'A'} color={color} size="lg" />
            <Text className="text-lg font-bold text-gray-900 mt-3">
              {state.onboarding.adminName || 'Admin'}
            </Text>
            <Text className="text-sm text-gray-400">Owner</Text>
          </Card>

          {/* Organizations */}
          <OrgSwitcher />

          {/* Operational Rules */}
          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Operational Rules
            </Text>
            <StepperRow
              icon="pause-circle"
              label="Stalled alert after"
              value={state.orgSettings.noChangeAlertWorkdays}
              unit="workdays"
              onMinus={() => void adjustSetting('noChangeAlertWorkdays', -1)}
              onPlus={() => void adjustSetting('noChangeAlertWorkdays', 1)}
              color={color}
            />
            <StepperRow
              icon="refresh-circle"
              label="Rework escalation after"
              value={state.orgSettings.reworkAlertCycles}
              unit="cycles"
              onMinus={() => void adjustSetting('reworkAlertCycles', -1)}
              onPlus={() => void adjustSetting('reworkAlertCycles', 1)}
              color={color}
              last
            />
          </Card>

          <Card>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Organization
            </Text>
            <SettingRow icon="business" label="Org Name" value={state.onboarding.orgName} />
            <SettingRow icon="briefcase" label="Industry" value={state.onboarding.industry?.name || '-'} />
            <SettingRow
              icon="location"
              label={state.onboarding.industry?.sitesLabel || 'Sites'}
              value={`${state.onboarding.sites.length} configured`}
            />
            <SettingRow icon="people" label="Teams" value={String(teams.length)} />
            <SettingRow icon="person" label="Employees" value={String(allEmployees.length)} />
            <SettingRow icon="clipboard" label="Total Tasks" value={String(state.tasks.length)} last />
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
            onPress={async () => {
              if (!state.isDemo) {
                await authClient.signOut();
              }
              dispatch({ type: 'SIGN_OUT' });
              router.replace('/');
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

function StepperRow({
  icon,
  label,
  value,
  unit,
  onMinus,
  onPlus,
  color,
  last,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
  color: string;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-gray-100'}`}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text className="text-sm text-gray-700 flex-1">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onMinus}
          className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
        >
          <Ionicons name="remove" size={16} color="#6b7280" />
        </Pressable>
        <Text className="text-sm font-semibold text-gray-900 min-w-[3rem] text-center px-1" numberOfLines={1}>
          {value} {unit === 'workdays' ? 'd' : unit === 'cycles' ? 'x' : unit}
        </Text>
        <Pressable
          onPress={onPlus}
          className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
        >
          <Ionicons name="add" size={16} color="#6b7280" />
        </Pressable>
      </View>
    </View>
  );
}
