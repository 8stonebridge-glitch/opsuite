import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { Select, type SelectOption } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { uid } from '../../utils/id';
import { getToday, getNowISO } from '../../utils/date';
import type { Task, Priority } from '../../types';

export function NewTaskScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const color = useIndustryColor();
  const sitesLabel = useSitesLabel();
  const curName = useCurrentName();
  const myTeam = useMyTeam();
  const allEmployees = useAllEmployees();
  const createTask = useMutation(api.tasks.create);
  const membershipDirectory = useQuery(
    api.memberships.listForActiveOrganization,
    !state.isDemo && authEnabled ? {} : 'skip'
  );

  const [title, setTitle] = useState('');
  const [siteId, setSiteId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    label: `${e.name} (${e.teamName}${e.role === 'subadmin' ? ' · Lead' : ''})`,
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

  const isValid = title.trim() && siteId && assigneeId && priority;

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

    if (!state.isDemo && authEnabled) {
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
          teamId: emp.teamId as never,
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
        teamId: emp.teamId,
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-5 pt-6 pb-3 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-gray-400">Cancel</Text>
        </Pressable>
        <Text className="text-base font-bold text-gray-900">Assign task</Text>
        <Pressable onPress={() => void handleSubmit()} disabled={!isValid || isSubmitting}>
          <Text
            className={`text-base font-bold ${!isValid || isSubmitting ? 'text-gray-300' : ''}`}
            style={isValid && !isSubmitting ? { color } : undefined}
          >
            {isSubmitting ? 'Saving...' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="gap-5 pb-20">
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done"
            autoFocus
            className="text-xl"
          />

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Select
                label={sitesLabel.slice(0, -1)}
                placeholder="Select"
                options={siteOptions}
                value={siteId}
                onChange={setSiteId}
              />
            </View>
            <View className="flex-1">
              <Select
                label="Assign to"
                placeholder="Select"
                options={empOptions}
                value={assigneeId}
                onChange={setAssigneeId}
              />
            </View>
          </View>

          <View>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Priority
            </Text>
            <View className="flex-row gap-2">
              {([['low', 'Low'], ['medium', 'Medium'], ['critical', 'High']] as const).map(
                ([val, label]) => (
                  <Pressable
                    key={val}
                    onPress={() => setPriority(val)}
                    className={`flex-1 py-3.5 rounded-xl items-center ${
                      priority !== val ? 'border border-gray-200' : ''
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
                        priority === val ? 'text-white' : 'text-gray-500'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <Input
            label="Due date"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />

          <Select
            label="Category"
            placeholder="Optional"
            options={catOptions}
            value={categoryId}
            onChange={setCategoryId}
          />

          <View>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Instruction note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note for employee"
              placeholderTextColor="#d1d5db"
              multiline
              numberOfLines={3}
              className="bg-gray-50 rounded-2xl px-4 py-3.5 text-sm text-gray-900 min-h-[80px]"
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
