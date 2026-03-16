import { View, Text, Pressable } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Avatar } from '../ui/Avatar';
import { Select } from '../ui/Select';
import {
  useCurrentName,
  useCurrentRoleLabel,
  useIndustryColor,
  useTeams,
} from '../../store/selectors';
import type { Role } from '../../types';
import { useRouter } from 'expo-router';
import { InboxButton } from '../inbox/InboxButton';

export function RoleSwitcher() {
  const { state, dispatch } = useApp();
  const name = useCurrentName();
  const roleLabel = useCurrentRoleLabel();
  const color = useIndustryColor();
  const teams = useTeams();
  const router = useRouter();

  // Non-demo accounts: show minimal header with org name + inbox button
  if (!state.isDemo) {
    return (
      <View className="bg-white dark:bg-gray-950 px-5 pt-5 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-3" style={{ minWidth: 0 }}>
          <Avatar name={state.onboarding.orgName || 'O'} color={color} />
          <View className="flex-1" style={{ minWidth: 0 }}>
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
              {state.onboarding.orgName || 'My Organization'}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>
              {roleLabel}
              {state.onboarding.industry ? ` · ${state.onboarding.industry.name}` : ''}
            </Text>
          </View>
        </View>
        <InboxButton />
      </View>
    );
  }

  const currentValue = `${state.role}|${state.userId || ''}`;

  const options = [
    { label: 'Owner', value: 'admin|' },
    ...teams.flatMap((t) => [
      { label: `${t.lead.name.split(' ')[0]} (${t.name} Lead)`, value: `subadmin|${t.lead.id}` },
      ...t.members.slice(0, 3).map((e) => ({
        label: `${e.name.split(' ')[0]} (${t.name})`,
        value: `employee|${e.id}`,
      })),
    ]),
  ];

  const handleSwitch = (val: string) => {
    const [role, userId] = val.split('|') as [Role, string];
    dispatch({ type: 'SWITCH_USER', role, userId: userId || null });
    // Navigate to appropriate home screen
    setTimeout(() => {
      if (role === 'admin') router.replace('/(owner_admin)/overview');
      else if (role === 'subadmin') router.replace('/(subadmin)/overview');
      else router.replace('/(employee)/my-day');
    }, 50);
  };

  return (
    <View className="bg-white dark:bg-gray-950 px-5 pt-5 pb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1 mr-3" style={{ minWidth: 0 }}>
        <Avatar name={name} color={color} />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
            {state.role === 'admin' ? state.onboarding.orgName : name}
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>
            {roleLabel}
            {state.onboarding.industry ? ` · ${state.onboarding.industry.name}` : ''}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <InboxButton />
        <Select
          placeholder="Switch role"
          options={options}
          value={currentValue}
          onChange={handleSwitch}
        />
      </View>
    </View>
  );
}
