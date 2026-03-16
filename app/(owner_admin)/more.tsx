import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useAuth } from '../../src/lib/clerk';
import { useIndustryColor, useTeams, useAllEmployees, useOrgMode, useSitesLabel } from '../../src/store/selectors';
import { useTheme } from '../../src/providers/ThemeProvider';
import { ThemeSwitcher } from '../../src/components/ui/ThemeSwitcher';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { OrgSwitcher } from '../../src/components/layout/OrgSwitcher';
import { uid } from '../../src/utils/id';

export default function OwnerMoreScreen() {
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const { signOut: clerkSignOut } = useAuth();
  const updateOrgSettings = useMutation(api.orgSettings.update);
  const updateOrgMode = useMutation(api.organizations.updateMode);
  const createSiteMutation = useMutation(api.sites.create);
  const color = useIndustryColor();
  const { isDark } = useTheme();
  const teams = useTeams();
  const allEmployees = useAllEmployees();
  const orgMode = useOrgMode();
  const sitesLabel = useSitesLabel();
  const router = useRouter();

  const [showCreateSite, setShowCreateSite] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [siteError, setSiteError] = useState('');
  const [isSavingSite, setIsSavingSite] = useState(false);

  const handleCreateSite = async () => {
    const trimmedName = siteName.trim();
    const trimmedCode = siteCode.trim();

    if (trimmedName.length < 2) {
      setSiteError('Enter a site name with at least 2 characters.');
      return;
    }

    setSiteError('');
    setIsSavingSite(true);

    try {
      if (!state.isDemo && authEnabled) {
        const createdSite = await createSiteMutation({
          name: trimmedName,
          code: trimmedCode || undefined,
        });

        if (createdSite) {
          dispatch({
            type: 'ADD_SITE',
            site: {
              id: String(createdSite._id),
              name: createdSite.name,
            },
          });
        }
      } else {
        dispatch({
          type: 'ADD_SITE',
          site: {
            id: uid(),
            name: trimmedName,
          },
        });
      }

      setSiteName('');
      setSiteCode('');
      setShowCreateSite(false);
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : 'We could not create that site yet.');
    } finally {
      setIsSavingSite(false);
    }
  };

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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 gap-3">
          <Card className="items-center py-6">
            <Avatar name={state.onboarding.adminName || 'A'} color={color} size="lg" />
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3">
              {state.onboarding.adminName || 'Admin'}
            </Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500">Owner</Text>
          </Card>

          {/* Organizations */}
          <OrgSwitcher />

          {/* Operational Rules */}
          <Card>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
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
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Organization
            </Text>
            <SettingRow icon="business" label="Org Name" value={state.onboarding.orgName} />
            <SettingRow icon="briefcase" label="Industry" value={state.onboarding.industry?.name || '-'} />
            <View className="flex-row items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
              <Ionicons name="location" size={18} color="#9ca3af" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                {sitesLabel}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500 mr-2">
                {state.onboarding.sites.length} configured
              </Text>
              <Pressable
                onPress={() => setShowCreateSite(true)}
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{ backgroundColor: color + '18' }}
              >
                <Ionicons name="add" size={16} color={color} />
              </Pressable>
            </View>
            <SettingRow icon="people" label="Teams" value={String(teams.length)} />
            <SettingRow icon="person" label="Employees" value={String(allEmployees.length)} />
            <SettingRow icon="clipboard" label="Total Tasks" value={String(state.tasks.length)} />

            <View className="flex-row items-center gap-3 py-3">
              <Ionicons name="git-branch-outline" size={18} color="#9ca3af" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">Org Mode</Text>
              <View className="flex-row rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <Pressable
                  onPress={() => {
                    if (orgMode === 'managed') return;
                    dispatch({ type: 'SET_ORG_MODE', mode: 'managed' });
                    if (!state.isDemo && authEnabled) {
                      void updateOrgMode({ mode: 'managed' }).catch((e: unknown) =>
                        console.warn('Failed to update org mode', e)
                      );
                    }
                  }}
                  className={`px-3 py-1.5 ${orgMode === 'managed' ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-50 dark:bg-gray-800'}`}
                >
                  <Text className={`text-xs font-semibold ${orgMode === 'managed' ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>
                    Managed
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (orgMode === 'direct') return;
                    dispatch({ type: 'SET_ORG_MODE', mode: 'direct' });
                    if (!state.isDemo && authEnabled) {
                      void updateOrgMode({ mode: 'direct' }).catch((e: unknown) =>
                        console.warn('Failed to update org mode', e)
                      );
                    }
                  }}
                  className={`px-3 py-1.5 ${orgMode === 'direct' ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-50 dark:bg-gray-800'}`}
                >
                  <Text className={`text-xs font-semibold ${orgMode === 'direct' ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>
                    Direct
                  </Text>
                </Pressable>
              </View>
            </View>
            <Text className="text-xs text-gray-400 dark:text-gray-500 -mt-1 ml-8 mb-1">
              {orgMode === 'managed' ? 'Teams with subadmin leads' : 'Admin manages employees directly'}
            </Text>
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
                // Clear local state first to prevent blank screen
                dispatch({ type: 'SIGN_OUT' });
                // Await auth cookie clear to prevent auto-re-authentication
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

      <Modal visible={showCreateSite} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setShowCreateSite(false)} />
        <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Add Site</Text>
            <Pressable onPress={() => setShowCreateSite(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Site Name
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
            placeholder="Victoria Hub"
            value={siteName}
            onChangeText={(text) => {
              setSiteName(text);
              setSiteError('');
            }}
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
          />

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Site Code (optional)
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
            placeholder="VIC-HUB"
            value={siteCode}
            onChangeText={(text) => {
              setSiteCode(text);
              setSiteError('');
            }}
            autoCapitalize="characters"
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
          />

          {siteError ? (
            <Text className="text-sm text-red-600 mb-4">{siteError}</Text>
          ) : null}

          <Button
            title={isSavingSite ? 'Creating site...' : 'Create Site'}
            onPress={() => void handleCreateSite()}
            disabled={isSavingSite}
            color={color}
          />
        </View>
      </Modal>
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
        style={{ maxWidth: '46%', flexShrink: 1 }}
        numberOfLines={2}
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
    <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-gray-100 dark:border-gray-800'}`}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1" numberOfLines={1} style={{ minWidth: 0 }}>{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onMinus}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
        >
          <Ionicons name="remove" size={16} color="#6b7280" />
        </Pressable>
        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[3rem] text-center px-1" numberOfLines={1}>
          {value} {unit === 'workdays' ? 'd' : unit === 'cycles' ? 'x' : unit}
        </Text>
        <Pressable
          onPress={onPlus}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
        >
          <Ionicons name="add" size={16} color="#6b7280" />
        </Pressable>
      </View>
    </View>
  );
}
