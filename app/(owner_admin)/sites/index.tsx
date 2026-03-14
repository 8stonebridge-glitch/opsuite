import { useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useApp } from '../../../src/store/AppContext';
import { useSiteHealth, useIndustryColor, useSitesLabel } from '../../../src/store/selectors';
import { useBackendAuth } from '../../../src/providers/BackendProviders';
import { RoleSwitcher } from '../../../src/components/layout/RoleSwitcher';
import { HealthCard } from '../../../src/components/overview/HealthCard';
import { Button } from '../../../src/components/ui/Button';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { uid } from '../../../src/utils/id';

export default function SitesScreen() {
  const { state, dispatch } = useApp();
  const color = useIndustryColor();
  const { isDark } = useTheme();
  const label = useSitesLabel();
  const router = useRouter();
  const { authEnabled } = useBackendAuth();
  const createSite = useMutation(api.sites.create);
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
        const createdSite = await createSite({
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          <View className="flex-row items-center justify-between mb-3 gap-3">
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-1">
              {label}
            </Text>
            <Pressable
              onPress={() => setShowCreateSite(true)}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
            >
              <Ionicons name="add" size={16} color={color} />
              <Text className="text-xs font-semibold" style={{ color }}>
                Add Site
              </Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {state.onboarding.sites.map((site) => (
              <SiteCard
                key={site.id}
                siteId={site.id}
                siteName={site.name}
                onPress={() => router.push(`/(owner_admin)/sites/${site.id}` as any)}
              />
            ))}
          </View>

          {state.onboarding.sites.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-sm text-gray-400 dark:text-gray-500">No {label.toLowerCase()} configured</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showCreateSite} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setShowCreateSite(false)} />
        <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Add Site</Text>
            <Pressable onPress={() => setShowCreateSite(false)}>
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

          <Text className="text-sm text-gray-400 dark:text-gray-500 leading-6 mb-5">
            New sites will appear across the owner overview, site health cards, and future task assignment flows.
          </Text>

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

function SiteCard({
  siteId,
  siteName,
  onPress,
}: {
  siteId: string;
  siteName: string;
  onPress: () => void;
}) {
  const health = useSiteHealth(siteId);
  return (
    <HealthCard
      title={siteName}
      icon="location"
      iconColor="#6366f1"
      onPress={onPress}
      stats={[
        { label: 'Active', value: health.totalActive, color: '#3b82f6' },
        { label: 'Overdue', value: health.overdue, color: '#dc2626' },
        { label: 'Review', value: health.review, color: '#d97706' },
        { label: 'Check-in', value: `${health.checkInRate}%`, color: '#059669' },
      ]}
    />
  );
}
