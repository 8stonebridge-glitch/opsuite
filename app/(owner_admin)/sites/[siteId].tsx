import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../src/store/AppContext';
import { useSiteTasks, useSiteHealth, useCheckInHealth, useIndustryColor, useTeams } from '../../../src/store/selectors';
import { isOverdue } from '../../../src/utils/date';
import { TaskPreviewSection } from '../../../src/components/overview/TaskPreviewSection';
import { Card } from '../../../src/components/ui/Card';
import { Avatar } from '../../../src/components/ui/Avatar';

export default function SiteDetailScreen() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const { state } = useApp();
  const router = useRouter();
  const color = useIndustryColor();

  const teams = useTeams();
  const site = state.onboarding.sites.find((s) => s.id === siteId);
  const siteTasks = useSiteTasks(siteId!);
  const health = useSiteHealth(siteId!);

  // Bucket tasks
  const active = siteTasks.filter((t) => t.status === 'Open' || t.status === 'In Progress');
  const review = siteTasks.filter((t) => t.status === 'Pending Approval' || t.status === 'Completed');
  const done = siteTasks.filter((t) => t.status === 'Verified');

  // Teams at this site (teams that have tasks assigned here)
  const teamIdsAtSite = [...new Set(siteTasks.map((t) => t.teamId))];
  const teamsAtSite = teams.filter((t) => teamIdsAtSite.includes(t.id));

  // Employees at this site
  const empIdsAtSite = [...new Set(siteTasks.map((t) => t.assigneeId))];
  const checkInHealth = useCheckInHealth(empIdsAtSite);

  const handleTaskPress = (taskId: string) => {
    router.push(`/(owner_admin)/tasks/${taskId}` as any);
  };

  if (!site) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Site not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{site.name}</Text>
          <Text className="text-xs text-gray-400">{siteTasks.length} total tasks</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Health Summary */}
        <View className="px-5 pt-2 pb-4">
          <View className="flex-row gap-2">
            <StatPill label="Active" value={health.totalActive} color="#3b82f6" />
            <StatPill label="Overdue" value={health.overdue} color="#dc2626" />
            <StatPill label="Review" value={health.review} color="#d97706" />
            <StatPill label="Check-in" value={`${health.checkInRate}%`} color="#059669" />
          </View>
        </View>

        {/* Task Sections */}
        <View className="px-5">
          <TaskPreviewSection
            title="Active"
            tasks={active}
            limit={7}
            onTaskPress={handleTaskPress}
            titleColor="#3b82f6"
            icon="flash"
            iconColor="#3b82f6"
          />

          <TaskPreviewSection
            title="Review"
            tasks={review}
            limit={5}
            onTaskPress={handleTaskPress}
            titleColor="#d97706"
            icon="eye"
            iconColor="#d97706"
          />

          <TaskPreviewSection
            title="Done"
            tasks={done}
            limit={5}
            onTaskPress={handleTaskPress}
            titleColor="#059669"
            icon="checkmark-circle"
            iconColor="#059669"
          />

          {siteTasks.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-sm text-gray-400">No tasks at this site</Text>
            </View>
          )}
        </View>

        {/* Teams at this Site */}
        {teamsAtSite.length > 0 && (
          <View className="px-5 mt-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Teams at this site
            </Text>
            <Card>
              {teamsAtSite.map((team, idx) => {
                const teamTasksHere = siteTasks.filter((t) => t.teamId === team.id);
                const activeHere = teamTasksHere.filter(
                  (t) => t.status === 'Open' || t.status === 'In Progress'
                ).length;
                const overdueHere = teamTasksHere.filter((t) => isOverdue(t.due, t.status)).length;

                return (
                  <View
                    key={team.id}
                    className={`flex-row items-center py-3 gap-3 ${
                      idx < teamsAtSite.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <Avatar name={team.name} color={team.color} size="sm" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">{team.name}</Text>
                      <Text className="text-xs text-gray-400">
                        {teamTasksHere.length} tasks · {activeHere} active
                        {overdueHere > 0 ? ` · ${overdueHere} overdue` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Check-in Overview */}
        <View className="px-5 mt-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Check-in Overview
          </Text>
          <Card>
            <View className="flex-row items-center gap-3">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: '#05966915' }}
              >
                <Ionicons name="people" size={18} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {checkInHealth.checkedInToday} of {checkInHealth.total} checked in
                </Text>
                <Text className="text-xs text-gray-400">Today's check-in rate</Text>
              </View>
              <Text className="text-lg font-bold" style={{ color: '#059669' }}>
                {checkInHealth.rate}%
              </Text>
            </View>
            {/* Progress bar */}
            <View className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: '#059669',
                  width: `${checkInHealth.rate}%`,
                }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View
      className="flex-1 items-center py-2 rounded-lg"
      style={{ backgroundColor: color + '10' }}
    >
      <Text className="text-base font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] font-medium text-gray-400">{label}</Text>
    </View>
  );
}
