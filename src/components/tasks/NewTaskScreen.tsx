import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Lazy-load DateTimePicker to avoid crash on web where the native module isn't available
const DateTimePicker = Platform.OS !== 'web'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? (require('@react-native-community/datetimepicker') as { default: typeof import('@react-native-community/datetimepicker').default }).default
  : null;
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useApp } from '../../store/AppContext';
import {
  useCurrentName,
  useIndustryColor,
  useSitesLabel,
  useMyTeam,
  useAllEmployees,
} from '../../store/selectors';
import { useBackendAuth } from '../../providers/BackendProviders';
import { useTheme } from '../../providers/ThemeProvider';
import { Select, type SelectOption } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { uid } from '../../utils/id';
import { getToday, getNowISO } from '../../utils/date';
import type { Task, Priority } from '../../types';

/** Convert a plural sitesLabel to singular properly (e.g. "Properties" -> "Property") */
function singularize(label: string): string {
  if (label.endsWith('ies')) return label.slice(0, -3) + 'y';
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}

export function NewTaskScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const { isDark } = useTheme();
  const color = useIndustryColor();
  const sitesLabel = useSitesLabel();
  const curName = useCurrentName();
  const myTeam = useMyTeam();
  const allEmployees = useAllEmployees();
  const isBackendMode = !state.isDemo && authEnabled;
  const createTask = useMutation(api.tasks.create);
  const membershipDirectory = useQuery(
    api.memberships.listForActiveOrganization,
    isBackendMode ? {} : 'skip'
  );

  // All hooks MUST be called before any early return (React Rules of Hooks)
  const [title, setTitle] = useState('');
  const [siteId, setSiteId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [dueDateError, setDueDateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Show loading state while backend data is hydrating
  if (isBackendMode && !state.isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color={color} />
      </SafeAreaView>
    );
  }

  // If org has no sites or employees yet, show helpful message instead of empty form
  if (state.onboarding.sites.length === 0 && allEmployees.length === 0 && isBackendMode && membershipDirectory === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color={color} />
        <Text className="text-sm text-gray-400 dark:text-gray-500 mt-4">Loading workspace data...</Text>
      </SafeAreaView>
    );
  }

  const siteOptions: SelectOption[] = state.onboarding.sites.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  // Admin sees both subadmins (team leads) and employees; subadmin sees own team members only
  const availableAssignees =
    state.role === 'subadmin' && myTeam
      ? myTeam.members
      : allEmployees; // admin gets all: leads + members

  const empOptions: SelectOption[] = availableAssignees.map((e) => ({
    label: `${e.name}${e.teamName ? ` (${e.teamName}${e.role === 'subadmin' ? ' · Lead' : ''})` : ''}`,
    value: e.id,
  }));

  const catOptions: SelectOption[] = state.categories.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const membershipByUserId = new Map(
    (membershipDirectory || [])
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => [String(entry.user._id), entry])
  );

  const isPastDate = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today!;
  };

  const isValid = title.trim() && siteId && assigneeId && priority && dueDate && !isPastDate(dueDate);

  /** Format a Date object to YYYY-MM-DD string */
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /** Parse YYYY-MM-DD string to Date, or return today */
  const parseDateValue = (): Date => {
    if (dueDate) {
      const parsed = new Date(dueDate + 'T00:00:00');
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const handleDateChange = (dateStr: string) => {
    setDueDate(dateStr);
    setTouched((prev) => ({ ...prev, dueDate: true }));
    if (isPastDate(dateStr)) {
      setDueDateError('Due date cannot be in the past');
    } else {
      setDueDateError('');
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    const site = state.onboarding.sites.find((s) => s.id === siteId);
    const emp = allEmployees.find((e) => e.id === assigneeId);
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!emp) return;

    setError('');

    const taskId = uid();
    const today = getToday();
    const now = getNowISO();

    // Determine accountableLeadId based on who is being assigned
    let accountableLeadId: string | undefined;
    if (state.role === 'admin') {
      if (emp.role === 'subadmin') {
        // Admin assigns to subadmin: subadmin is the accountable lead
        accountableLeadId = emp.id;
      } else {
        // Admin assigns directly to employee
        accountableLeadId = 'admin';
      }
    } else if (state.role === 'subadmin') {
      // Subadmin assigns to team member: subadmin is accountable lead
      accountableLeadId = state.userId || undefined;
    }

    if (isBackendMode) {
      setIsSubmitting(true);

      try {
        const assigneeMembership = membershipByUserId.get(assigneeId);
        const accountableLeadMembership =
          accountableLeadId === 'admin'
            ? membershipDirectory?.find((entry) => entry?.membership.role === 'owner_admin')
            : membershipByUserId.get(accountableLeadId || '');

        if (!assigneeMembership || !accountableLeadMembership) {
          throw new Error('This person is not synced to the active organization yet.');
        }

        await createTask({
          title: title.trim(),
          description: cat?.name,
          priority: priority as Priority,
          siteId: siteId as never,
          teamId: (emp.teamId || undefined) as never,
          assignedToMembershipId: String(assigneeMembership.membership._id) as never,
          accountableLeadMembershipId: String(accountableLeadMembership.membership._id) as never,
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
        });

        router.back();
        return;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'We could not create that task yet.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const task: Task = {
        id: taskId,
        title: title.trim(),
        site: site?.name || '',
        siteId,
        category: cat?.name,
        priority: priority as Priority,
        due: dueDate || null,
        assignee: emp.name,
        assigneeId,
        teamId: emp.teamId || '',
        status: 'Open',
        assignedBy: curName,
        assignedByRole: state.role,
        note: note.trim() || undefined,
        approved: true,
        createdAt: today,
        accountableLeadId,
        delegatedAt: state.role === 'subadmin' ? now : undefined,
      };

      dispatch({ type: 'ADD_TASK', task });
      dispatch({
        type: 'ADD_AUDIT',
        entry: {
          taskId, role: 'System',
          message: `Task assigned to ${emp.name} by ${curName}.${dueDate ? ` Due date: ${dueDate}.` : ''}`,
          createdAt: now, dateTag: today, updateType: 'Assignment',
        },
      });
      if (note.trim()) {
        dispatch({
          type: 'ADD_AUDIT',
          entry: {
            taskId, role: state.role === 'admin' ? 'Admin' : 'SubAdmin',
            message: note.trim(),
            createdAt: now, dateTag: today, updateType: 'Instruction',
          },
        });
      }

      router.back();
    }
  };

  const singleSiteLabel = singularize(sitesLabel);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
      <View className="px-5 pt-6 pb-3 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-gray-400 dark:text-gray-500">Cancel</Text>
        </Pressable>
        <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Assign task</Text>
        <Pressable
          onPress={() => {
            if (!isValid) {
              setTouched({ title: true, siteId: true, assigneeId: true, priority: true, dueDate: true });
              return;
            }
            void handleSubmit();
          }}
          disabled={isSubmitting}
        >
          <Text
            className={`text-base font-bold ${!isValid || isSubmitting ? 'text-gray-300 dark:text-gray-600' : ''}`}
            style={isValid && !isSubmitting ? { color } : undefined}
          >
            {isSubmitting ? 'Saving...' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="gap-5 pb-20">
          <View>
            <Input
              label="Title"
              value={title}
              onChangeText={(val) => { setTitle(val); setTouched((prev) => ({ ...prev, title: true })); }}
              placeholder="What needs to be done"
              autoFocus
              className="text-xl"
            />
            {touched.title && !title.trim() ? (
              <Text className="text-xs text-red-600 mt-1">Title is required</Text>
            ) : null}
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Select
                label={singleSiteLabel}
                placeholder="Select"
                options={siteOptions}
                value={siteId}
                onChange={(val) => { setSiteId(val); setTouched((prev) => ({ ...prev, siteId: true })); }}
              />
              {touched.siteId && !siteId ? (
                <Text className="text-xs text-red-600 mt-1">{singleSiteLabel} is required</Text>
              ) : null}
            </View>
            <View className="flex-1">
              <Select
                label="Assign to"
                placeholder="Select"
                options={empOptions}
                value={assigneeId}
                onChange={(val) => { setAssigneeId(val); setTouched((prev) => ({ ...prev, assigneeId: true })); }}
              />
              {touched.assigneeId && !assigneeId ? (
                <Text className="text-xs text-red-600 mt-1">Assignee is required</Text>
              ) : null}
            </View>
          </View>

          <View>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Priority
            </Text>
            <View className="flex-row gap-2">
              {([['low', 'Low'], ['medium', 'Medium'], ['critical', 'High']] as const).map(
                ([val, label]) => (
                  <Pressable
                    key={val}
                    onPress={() => { setPriority(val); setTouched((prev) => ({ ...prev, priority: true })); }}
                    className={`flex-1 py-3.5 rounded-xl items-center ${
                      priority !== val ? 'border border-gray-200 dark:border-gray-700' : ''
                    }`}
                    style={
                      priority === val
                        ? {
                            backgroundColor:
                              val === 'critical' ? '#dc2626' : val === 'medium' ? '#d97706' : color,
                          }
                        : undefined
                    }
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        priority === val ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
            {touched.priority && !priority ? (
              <Text className="text-xs text-red-600 mt-1">Priority is required</Text>
            ) : null}
          </View>

          <View>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Due date
            </Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  backgroundColor: isDark ? '#111827' : '#f9fafb',
                  borderRadius: 16,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 14,
                  paddingBottom: 14,
                  fontSize: 16,
                  color: dueDate ? (isDark ? '#f3f4f6' : '#111827') : (isDark ? '#4b5563' : '#d1d5db'),
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
                >
                  <Text
                    className={`text-base ${dueDate ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}
                  >
                    {dueDate || 'Tap to select date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={isDark ? '#6b7280' : '#9ca3af'} />
                </Pressable>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={parseDateValue()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(_event: unknown, selectedDate?: Date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        handleDateChange(formatDate(selectedDate));
                      }
                    }}
                  />
                )}
              </>
            )}
            {dueDateError ? (
              <Text className="text-xs text-red-600 mt-1">{dueDateError}</Text>
            ) : touched.dueDate && !dueDate ? (
              <Text className="text-xs text-red-600 mt-1">Due date is required</Text>
            ) : null}
          </View>

          <Select
            label="Category"
            placeholder="Optional"
            options={catOptions}
            value={categoryId}
            onChange={setCategoryId}
          />

          <View>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Instruction note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note for employee"
              placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
              multiline
              numberOfLines={3}
              className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-sm text-gray-900 dark:text-gray-100 min-h-[80px]"
              textAlignVertical="top"
            />
          </View>

          {error ? (
            <Text className="text-sm text-red-600">{error}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
