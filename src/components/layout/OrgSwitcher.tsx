import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useApp } from '../../store/AppContext';
import { useBackendAuth } from '../../providers/BackendProviders';
import { Card } from '../ui/Card';

const INDUSTRY_ICONS: Record<string, string> = {
  fm: 'business',
  construction: 'construct',
  hospitality: 'bed',
  manufacturing: 'cog',
  retail: 'storefront',
  healthcare: 'medkit',
  security: 'shield-checkmark',
  cleaning: 'sparkles',
};

export function OrgSwitcher() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const { authEnabled } = useBackendAuth();
  const setActiveOrganization = useMutation(api.users.setActiveOrganization);

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === state.activeWorkspaceId) return;

    if (!state.isDemo && authEnabled) {
      try {
        await setActiveOrganization({ organizationId: workspaceId as never });
      } catch (error) {
        console.warn('Failed to persist active organization in Convex.', error);
      }
    }

    dispatch({ type: 'SWITCH_ORGANIZATION', workspaceId });
    router.replace('/(owner_admin)/overview' as any);
  };

  return (
    <View>
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Organizations ({state.workspaces.length})
      </Text>
      <View className="gap-2">
        {state.workspaces.map((ws) => {
          const isActive = ws.id === state.activeWorkspaceId;
          const icon = INDUSTRY_ICONS[ws.industry?.id || ''] || 'business';
          const color = ws.industry?.color || '#6b7280';

          return (
            <Pressable key={ws.id} onPress={() => void handleSwitch(ws.id)}>
              <Card
                className={`flex-row items-center gap-3 ${
                  isActive ? 'border-2' : ''
                }`}
                style={isActive ? { borderColor: color } : undefined}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: color + '18' }}
                >
                  <Ionicons name={icon as any} size={20} color={color} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
                    {ws.orgName}
                  </Text>
                  <Text className="text-xs text-gray-400" numberOfLines={2}>
                    {ws.industry?.name || 'General'}
                  </Text>
                </View>
                {isActive && (
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
