import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import {
  useIndustryColor,
  useCurrentName,
  useMyCheckIns,
  useCheckInStats,
} from '../../src/store/selectors';
import { useScopedTasks } from '../../src/store/selectors';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { getToday, getNowISO } from '../../src/utils/date';
import {
  getCurrentWeekDays,
  getDayLabel,
  getCheckInForDate,
  formatCheckInDate,
  formatMonthLabel,
  getMonthDays,
} from '../../src/utils/checkin-helpers';
import type { CheckIn } from '../../src/types';

type StatsTab = 'checked' | 'missed' | 'rate' | 'streaks';

export default function EmployeeCheckInScreen() {
  const { state, dispatch } = useApp();
  const color = useIndustryColor();
  const curName = useCurrentName();
  const myCheckIns = useMyCheckIns();
  const myTasks = useScopedTasks();
  const today = getToday();

  // Month navigation
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const stats = useCheckInStats(viewYear, viewMonth);

  const [activeTab, setActiveTab] = useState<StatsTab>('checked');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const todayCheckIn = useMemo(
    () => state.checkIns.find((c) => c.userId === state.userId && c.date === today),
    [state.checkIns, state.userId, today]
  );

  const weekDays = getCurrentWeekDays(today);

  const openTasks = myTasks.filter((t) => t.status === 'Open' || t.status === 'In Progress');

  const handleCheckIn = () => {
    const nowTime = new Date();
    const time = `${String(nowTime.getHours()).padStart(2, '0')}:${String(nowTime.getMinutes()).padStart(2, '0')}`;
    const type = openTasks.length > 0 ? 'Tasks Logged' : 'No Tasks';
    const summary = openTasks.length > 0
      ? `${openTasks.length} open tasks reviewed`
      : 'No active tasks';

    dispatch({
      type: 'ADD_CHECKIN',
      checkIn: {
        userId: state.userId!,
        date: today,
        status: 'Checked-In',
        type,
        checkedInAt: time,
        summary,
      },
    });

    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: null,
        role: 'System',
        message: `Daily check-in by ${curName}. ${summary}.`,
        createdAt: getNowISO(),
        dateTag: today,
        updateType: 'Check-in',
      },
    });
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Month check-in data for list views
  const monthDays = useMemo(() => {
    const days = getMonthDays(viewYear, viewMonth).filter((d) => d <= today);
    // Weekdays only
    return days.filter((d) => {
      const dow = new Date(`${d}T12:00:00`).getDay();
      return dow >= 1 && dow <= 5;
    }).reverse();
  }, [viewYear, viewMonth, today]);

  const checkedDays = useMemo(
    () => monthDays.filter((d) => getCheckInForDate(state.checkIns, state.userId || '', d)?.status === 'Checked-In'),
    [monthDays, state.checkIns, state.userId]
  );

  const missedDays = useMemo(
    () => monthDays.filter((d) => !getCheckInForDate(state.checkIns, state.userId || '', d) || getCheckInForDate(state.checkIns, state.userId || '', d)?.status === 'Missed'),
    [monthDays, state.checkIns, state.userId]
  );

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Check-in CTA */}
        <View className="px-5 pt-4">
          {!todayCheckIn ? (
            <Card className="mb-4">
              <View className="items-center py-4">
                <View className="h-16 w-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: `${color}18` }}>
                  <Ionicons name="checkmark-circle" size={32} color={color} />
                </View>
                <Text className="text-lg font-bold text-gray-900 mb-1">Daily Handoff</Text>
                <Text className="text-sm text-gray-400 mb-4 text-center">
                  {openTasks.length > 0
                    ? `You have ${openTasks.length} open task${openTasks.length > 1 ? 's' : ''}`
                    : 'No active tasks today'}
                </Text>
                <Button title="Check In Now" onPress={handleCheckIn} color={color} className="w-full" />
              </View>
            </Card>
          ) : (
            <Card className="mb-4">
              <View className="items-center py-3">
                <Ionicons name="checkmark-circle" size={40} color={color} />
                <Text className="text-base font-bold text-gray-900 mt-1">Checked In</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Today at {todayCheckIn.checkedInAt} · {todayCheckIn.summary}
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* 7-Day Strip */}
        <View className="px-5 mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            This Week
          </Text>
          <Card>
            <View className="flex-row justify-between">
              {weekDays.map((day) => {
                const ci = getCheckInForDate(state.checkIns, state.userId || '', day);
                const isFuture = day > today;
                const isToday = day === today;
                const checked = ci?.status === 'Checked-In';
                const dow = new Date(`${day}T12:00:00`).getDay();
                const isWeekend = dow === 0 || dow === 6;

                return (
                  <Pressable
                    key={day}
                    onPress={() => !isFuture && setExpandedDate(expandedDate === day ? null : day)}
                    className="items-center flex-1"
                  >
                    <Text className={`text-xs mb-1 ${isToday ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
                      {getDayLabel(day)}
                    </Text>
                    <View
                      className={`h-9 w-9 rounded-full items-center justify-center ${
                        isToday ? 'border-2' : ''
                      }`}
                      style={isToday ? { borderColor: color } : undefined}
                    >
                      {isFuture || isWeekend ? (
                        <View className="h-2 w-2 rounded-full bg-gray-200" />
                      ) : checked ? (
                        <Ionicons name="checkmark-circle" size={24} color="#059669" />
                      ) : (
                        <Ionicons name="close-circle" size={24} color="#dc2626" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Expanded day detail */}
            {expandedDate && (
              <View className="mt-3 pt-3 border-t border-gray-100">
                <DayDetail
                  date={expandedDate}
                  checkIn={getCheckInForDate(state.checkIns, state.userId || '', expandedDate)}
                />
              </View>
            )}
          </Card>
        </View>

        {/* Month Navigation */}
        <View className="px-5 mb-3">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={prevMonth} className="p-2">
              <Ionicons name="chevron-back" size={20} color="#6b7280" />
            </Pressable>
            <Text className="text-sm font-semibold text-gray-700">
              {formatMonthLabel(viewYear, viewMonth)}
            </Text>
            <Pressable onPress={nextMonth} className="p-2" style={isCurrentMonth ? { opacity: 0.3 } : undefined}>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* Stats Tabs */}
        <View className="px-5 mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <StatTab
                label="Checked"
                value={stats.checked}
                active={activeTab === 'checked'}
                activeColor="#059669"
                onPress={() => setActiveTab('checked')}
              />
              <StatTab
                label="Missed"
                value={stats.missed}
                active={activeTab === 'missed'}
                activeColor="#dc2626"
                onPress={() => setActiveTab('missed')}
              />
              <StatTab
                label="Rate"
                value={`${stats.percentage}%`}
                active={activeTab === 'rate'}
                activeColor="#3b82f6"
                onPress={() => setActiveTab('rate')}
              />
              <StatTab
                label="Streaks"
                value={stats.currentStreak}
                active={activeTab === 'streaks'}
                activeColor="#f59e0b"
                onPress={() => setActiveTab('streaks')}
              />
            </View>
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View className="px-5">
          {activeTab === 'checked' && (
            <CheckInList
              days={checkedDays}
              checkIns={state.checkIns}
              userId={state.userId || ''}
              emptyMessage="No check-ins this month"
              color={color}
            />
          )}
          {activeTab === 'missed' && (
            <CheckInList
              days={missedDays}
              checkIns={state.checkIns}
              userId={state.userId || ''}
              emptyMessage="No missed days this month"
              color="#dc2626"
              isMissed
            />
          )}
          {activeTab === 'rate' && (
            <RateView stats={stats} color={color} />
          )}
          {activeTab === 'streaks' && (
            <StreaksView stats={stats} color={color} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Sub-components ---

function StatTab({
  label,
  value,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  value: string | number;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2.5 rounded-2xl ${active ? '' : 'bg-gray-100'}`}
      style={active ? { backgroundColor: activeColor } : undefined}
    >
      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-500'}`}>
        {label}
      </Text>
      <Text className={`text-lg font-bold ${active ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </Text>
    </Pressable>
  );
}

function DayDetail({ date, checkIn }: { date: string; checkIn?: CheckIn }) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-900 mb-1">{formatCheckInDate(date)}</Text>
      {checkIn?.status === 'Checked-In' ? (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={14} color="#059669" />
            <Text className="text-xs text-gray-600">Checked in at {checkIn.checkedInAt}</Text>
          </View>
          {checkIn.type && (
            <View className="flex-row items-center gap-2">
              <Ionicons name="document-text-outline" size={14} color="#6b7280" />
              <Text className="text-xs text-gray-600">{checkIn.type}</Text>
            </View>
          )}
          {checkIn.summary && (
            <View className="flex-row items-center gap-2">
              <Ionicons name="chatbox-outline" size={14} color="#6b7280" />
              <Text className="text-xs text-gray-500">{checkIn.summary}</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
          <Text className="text-xs text-red-500">Missed</Text>
        </View>
      )}
    </View>
  );
}

function CheckInList({
  days,
  checkIns,
  userId,
  emptyMessage,
  color,
  isMissed,
}: {
  days: string[];
  checkIns: CheckIn[];
  userId: string;
  emptyMessage: string;
  color: string;
  isMissed?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (days.length === 0) {
    return (
      <View className="py-8 items-center">
        <Ionicons name={isMissed ? 'happy-outline' : 'calendar-outline'} size={32} color="#d1d5db" />
        <Text className="text-gray-400 text-sm mt-2">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {days.map((day) => {
        const ci = getCheckInForDate(checkIns, userId, day);
        const isExpanded = expanded === day;

        return (
          <Pressable key={day} onPress={() => setExpanded(isExpanded ? null : day)}>
            <Card>
              <View className="flex-row items-center gap-3">
                <View
                  className="h-8 w-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: isMissed ? '#fef2f2' : '#f0fdf4' }}
                >
                  <Ionicons
                    name={isMissed ? 'close' : 'checkmark'}
                    size={16}
                    color={isMissed ? '#dc2626' : '#059669'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    {formatCheckInDate(day)}
                  </Text>
                  {!isMissed && ci?.checkedInAt && (
                    <Text className="text-xs text-gray-400">
                      {ci.checkedInAt} · {ci.summary || ''}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#9ca3af"
                />
              </View>

              {isExpanded && (
                <View className="mt-3 pt-3 border-t border-gray-100">
                  <DayDetail date={day} checkIn={ci} />
                </View>
              )}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

function RateView({ stats, color }: { stats: { checked: number; missed: number; percentage: number }; color: string }) {
  const total = stats.checked + stats.missed;

  return (
    <Card>
      <View className="items-center py-4">
        <Text className="text-5xl font-bold" style={{ color }}>
          {stats.percentage}%
        </Text>
        <Text className="text-sm text-gray-400 mt-1">Attendance Rate</Text>

        {/* Progress bar */}
        <View className="w-full h-3 bg-gray-100 rounded-full mt-4 overflow-hidden">
          <View
            className="h-3 rounded-full"
            style={{ width: `${stats.percentage}%`, backgroundColor: color }}
          />
        </View>

        <View className="flex-row justify-between w-full mt-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <Text className="text-xs text-gray-500">{stats.checked} checked</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            <Text className="text-xs text-gray-500">{stats.missed} missed</Text>
          </View>
          <Text className="text-xs text-gray-400">{total} workdays</Text>
        </View>
      </View>
    </Card>
  );
}

function StreaksView({ stats, color }: { stats: { currentStreak: number; longestStreak: number }; color: string }) {
  return (
    <View className="gap-3">
      <Card>
        <View className="items-center py-5">
          <View className="h-16 w-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: '#fef3c7' }}>
            <Ionicons name="flame" size={32} color="#f59e0b" />
          </View>
          <Text className="text-4xl font-bold text-gray-900">{stats.currentStreak}</Text>
          <Text className="text-sm text-gray-400 mt-1">Current Streak</Text>
          <Text className="text-xs text-gray-300 mt-0.5">consecutive workdays</Text>
        </View>
      </Card>

      <Card className="flex-row items-center gap-4">
        <View className="h-10 w-10 rounded-full items-center justify-center bg-amber-50">
          <Ionicons name="trophy" size={20} color="#f59e0b" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900">Best Streak</Text>
          <Text className="text-xs text-gray-400">Your longest run</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900">{stats.longestStreak}</Text>
      </Card>

      {stats.currentStreak >= 5 && (
        <Card className="items-center py-3" style={{ backgroundColor: '#fefce8' }}>
          <Text className="text-sm font-semibold text-amber-700">
            {stats.currentStreak >= 20
              ? 'Legendary! Keep going!'
              : stats.currentStreak >= 10
              ? 'On fire! Amazing consistency!'
              : 'Great start! Keep the momentum!'}
          </Text>
        </Card>
      )}
    </View>
  );
}
