import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../../src/store/AppContext';
import {
  useMyDayData,
  useMyPerformance,
  useIndustryColor,
  useCurrentName,
  useHandoffProgress,
  useHasCompletedHandoffToday,
  useIsProtectedUnavailableToday,
} from '../../src/store/selectors';
import { getToday, getNowISO } from '../../src/utils/date';
import { buildHandoffSummary } from '../../src/utils/handoff-helpers';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { TaskPreviewSection } from '../../src/components/overview/TaskPreviewSection';
import { PerformanceCard } from '../../src/components/performance/PerformanceCard';
import { Card } from '../../src/components/ui/Card';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useTheme } from '../../src/providers/ThemeProvider';

export default function EmployeeMyDayScreen() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const { authEnabled } = useBackendAuth();
  const { isDark } = useTheme();
  const color = useIndustryColor();
  const name = useCurrentName();
  const localMyDay = useMyDayData();
  const myPerf = useMyPerformance();
  const localHandoff = useHandoffProgress();
  const localHandoffDone = useHasCompletedHandoffToday();
  const isUnavailable = useIsProtectedUnavailableToday();

  const today = getToday();
  const isBackendMode = !state.isDemo && authEnabled;
  const backendTaskLists = useQuery(
    api.tasks.listForCurrentScope,
    isBackendMode ? {} : 'skip'
  );
  const backendHandoff = useQuery(
    api.handoffs.myProgress,
    isBackendMode ? { date: today } : 'skip'
  );
  const markNoChange = useMutation(api.tasks.markNoChange);
  const completeHandoff = useMutation(api.handoffs.completeForToday);
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);
  const [isSubmittingNoChangeId, setIsSubmittingNoChangeId] = useState<string | null>(null);

  const backendTasks = backendTaskLists?.scopedTasks || [];
  const { dueToday, overdue, inProgress } = useMemo(() => {
    if (!isBackendMode) {
      return localMyDay;
    }

    return {
      dueToday: backendTasks.filter(
        (task) => task.due === today && (task.status === 'Open' || task.status === 'In Progress')
      ),
      overdue: backendTasks.filter((task) => task.due && task.due < today && (task.status === 'Open' || task.status === 'In Progress')),
      inProgress: backendTasks.filter(
        (task) => task.status === 'In Progress' && (!task.due || task.due >= today)
      ),
      checkedInToday: Boolean(backendHandoff?.handoffDone),
    };
  }, [backendHandoff?.handoffDone, backendTasks, isBackendMode, localMyDay, today]);

  const handoff = isBackendMode
    ? {
        total: backendHandoff?.total || 0,
        engaged: backendHandoff?.engaged || 0,
        remaining: backendHandoff?.remainingTasks || [],
      }
    : localHandoff;
  const handoffDone = isBackendMode ? Boolean(backendHandoff?.handoffDone) : localHandoffDone;

  // Mark a task as "No Change" for handoff engagement
  const handleNoChange = async (taskId: string) => {
    if (isBackendMode) {
      setIsSubmittingNoChangeId(taskId);
      try {
        await markNoChange({ taskId: taskId as never });
      } finally {
        setIsSubmittingNoChangeId(null);
      }
      return;
    }

    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId,
        role: 'Employee',
        message: `No change reported by ${name}.`,
        createdAt: getNowISO(),
        dateTag: today,
        updateType: 'No Change',
      },
    });
    // Update task's lastNoChangeAt
    dispatch({
      type: 'UPDATE_TASK',
      taskId,
      updates: { lastNoChangeAt: today },
    });
  };

  // Complete the daily handoff
  const handleCompleteHandoff = async () => {
    if (isBackendMode) {
      setIsSubmittingHandoff(true);
      try {
        await completeHandoff({ date: today });
      } finally {
        setIsSubmittingHandoff(false);
      }
      return;
    }

    const summary = buildHandoffSummary(state.tasks, state.userId || '', state.audit);
    dispatch({ type: 'ADD_HANDOFF', handoff: summary });

    // Also create a check-in for backward compatibility
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    dispatch({
      type: 'ADD_CHECKIN',
      checkIn: {
        userId: state.userId || '',
        date: today,
        status: 'Checked-In',
        type: summary.type === 'tasks_reviewed' ? 'Tasks Reviewed' : 'No Tasks',
        checkedInAt: time,
        summary:
          summary.type === 'tasks_reviewed'
            ? `${summary.tasksSummary.length} tasks reviewed`
            : 'No active tasks',
      },
    });

    // Audit entry
    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: null,
        role: 'System',
        message:
          summary.type === 'tasks_reviewed'
            ? `Daily handoff by ${name}. ${summary.tasksSummary.length} tasks reviewed.`
            : `Daily handoff by ${name}. No active tasks.`,
        createdAt: getNowISO(),
        dateTag: today,
        updateType: summary.type === 'tasks_reviewed' ? 'Daily Handoff' : 'No Tasks Today',
      },
    });
  };

  // Handle "No tasks" quick handoff
  const handleNoTasksHandoff = async () => {
    await handleCompleteHandoff();
  };

  const goToTask = (id: string) => {
    router.push(`/(employee)/tasks/${id}` as any);
  };

  const goToTasks = () => {
    router.push('/(employee)/tasks' as any);
  };

  const isEmpty = dueToday.length === 0 && overdue.length === 0 && inProgress.length === 0;

  const allEngaged = handoff.remaining.length === 0 && handoff.total > 0;
  const engagedTaskIds = isBackendMode ? backendHandoff?.engagedTaskIds || [] : [];
  const engagedTasks = isBackendMode
    ? backendTasks.filter(
        (task) =>
          engagedTaskIds.includes(task.id) &&
          (task.status === 'Open' || task.status === 'In Progress')
      )
    : state.tasks.filter(
        (task) =>
          task.assigneeId === state.userId &&
          (task.status === 'Open' || task.status === 'In Progress') &&
          !handoff.remaining.some((remainingTask) => remainingTask.id === task.id)
      );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4 gap-4">
          {isBackendMode && (!backendTaskLists || !backendHandoff) ? (
            <Card className="flex-row items-center gap-3">
              <Ionicons name="sync" size={18} color={color} />
              <Text className="text-sm text-gray-600 dark:text-gray-400">Loading your handoff...</Text>
            </Card>
          ) : null}

          {/* Unavailable banner — informational, does not block handoff */}
          {isUnavailable && !handoffDone && (
            <Card className="flex-row items-center gap-4">
              <View
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: '#6366f115' }}
              >
                <Ionicons name="moon" size={24} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">You are unavailable today</Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  You can still review your tasks below if needed
                </Text>
              </View>
            </Card>
          )}

          {/* Handoff Section */}
          {handoffDone ? (
            // Already completed today
            <Card className="flex-row items-center gap-4">
              <View
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: '#05966915' }}
              >
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">Handoff Complete</Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  All tasks reviewed for today
                </Text>
              </View>
            </Card>
          ) : handoff.total === 0 ? (
            // No active tasks — quick handoff
            <Pressable onPress={handleNoTasksHandoff}>
              <Card className="flex-row items-center gap-4">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{ backgroundColor: color + '15' }}
                >
                  <Ionicons name="sunny" size={24} color={color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Good morning, {name.split(' ')[0]}
                  </Text>
                  <Text className="text-xs text-gray-400 dark:text-gray-500">No active tasks · Tap to complete handoff</Text>
                </View>
                <View
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: color }}
                >
                  <Text className="text-xs font-semibold text-white">Done</Text>
                </View>
              </Card>
            </Pressable>
          ) : (
            // Active tasks — gated handoff
            <Card>
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="hand-left" size={16} color={color} />
                <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Daily Handoff
                </Text>
                <View className="flex-1" />
                <Text className="text-xs font-semibold" style={{ color }}>
                  {handoff.engaged}/{handoff.total}
                </Text>
              </View>

              {/* Progress bar */}
              <View className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${handoff.total > 0 ? (handoff.engaged / handoff.total) * 100 : 0}%`,
                    backgroundColor: allEngaged ? '#059669' : color,
                  }}
                />
              </View>

              {/* Task list with quick actions */}
              {handoff.remaining.map((task) => (
                <View
                  key={task.id}
                  className="flex-row items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800"
                >
                  <View className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <View className="flex-1">
                    <Text className="text-sm text-gray-900 dark:text-gray-100" numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500">{task.site}</Text>
                  </View>
                  <Pressable
                    onPress={() => goToTask(task.id)}
                    className="px-2.5 py-1.5 bg-blue-50 rounded-lg"
                  >
                    <Text className="text-[10px] font-semibold text-blue-600">Update</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleNoChange(task.id)}
                    className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"
                  >
                    <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      {isSubmittingNoChangeId === task.id ? 'Saving...' : 'No change'}
                    </Text>
                  </Pressable>
                </View>
              ))}

              {/* Engaged tasks */}
              {engagedTasks.length > 0 &&
                engagedTasks.map((task) => (
                    <View
                      key={task.id}
                      className="flex-row items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800"
                    >
                      <Ionicons name="checkmark-circle" size={14} color="#059669" />
                      <View className="flex-1">
                        <Text className="text-sm text-gray-400 dark:text-gray-500" numberOfLines={1}>
                          {task.title}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-green-600 font-medium">Done</Text>
                    </View>
                  ))}

              {/* Complete Handoff button */}
              <Pressable
                onPress={() => void handleCompleteHandoff()}
                disabled={!allEngaged || isSubmittingHandoff}
                className="mt-4 py-3 rounded-xl items-center"
                style={{
                  backgroundColor: allEngaged && !isSubmittingHandoff ? color : isDark ? '#374151' : '#e5e7eb',
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: allEngaged && !isSubmittingHandoff ? '#fff' : '#9ca3af' }}
                >
                  {isSubmittingHandoff ? 'Completing...' : 'Complete Handoff'}
                </Text>
              </Pressable>
            </Card>
          )}

          {/* My Performance */}
          {!isBackendMode && myPerf && (
            <PerformanceCard performance={myPerf} compact color={color} />
          )}

          {/* Task Sections */}
          {overdue.length > 0 && (
            <TaskPreviewSection
              title="Overdue"
              tasks={overdue}
              limit={5}
              onTaskPress={goToTask}
              onViewAll={goToTasks}
              titleColor="#dc2626"
              icon="alert-circle"
              iconColor="#dc2626"
            />
          )}

          {dueToday.length > 0 && (
            <TaskPreviewSection
              title="Due Today"
              tasks={dueToday}
              limit={5}
              onTaskPress={goToTask}
              onViewAll={goToTasks}
              titleColor="#d97706"
              icon="time"
              iconColor="#d97706"
            />
          )}

          {inProgress.length > 0 && (
            <TaskPreviewSection
              title="In Progress"
              tasks={inProgress}
              limit={5}
              onTaskPress={goToTask}
              onViewAll={goToTasks}
              titleColor="#3b82f6"
              icon="play-circle"
              iconColor="#3b82f6"
            />
          )}

          {isEmpty && handoffDone && (
            <View className="items-center py-12">
              <Ionicons name="checkmark-done-circle" size={48} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className="text-sm text-gray-400 dark:text-gray-500 mt-3">All clear for today</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
