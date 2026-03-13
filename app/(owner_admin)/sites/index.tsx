import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '../../../src/store/AppContext';
import { useSiteHealth, useIndustryColor, useSitesLabel } from '../../../src/store/selectors';
import { RoleSwitcher } from '../../../src/components/layout/RoleSwitcher';
import { HealthCard } from '../../../src/components/overview/HealthCard';

export default function SitesScreen() {
  const { state } = useApp();
  const color = useIndustryColor();
  const label = useSitesLabel();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {label}
          </Text>
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
              <Text className="text-sm text-gray-400">No {label.toLowerCase()} configured</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
