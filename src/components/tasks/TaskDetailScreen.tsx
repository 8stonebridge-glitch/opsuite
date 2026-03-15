import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useApp } from '../../store/AppContext';
import {
  useTaskAudit,
  useCurrentName,
  useCurrentRoleLabel,
  useIndustryColor,
  useMyTeam,
  useAllEmployees,
} from '../../store/selectors';
import { useBackendAuth } from '../../providers/BackendProviders';
import { useTheme } from '../../providers/ThemeProvider';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select, type SelectOption } from '../ui/Select';
import { AuditTrail } from './AuditTrail';
import { getToday, getNowISO, formatDue, isOverdue } from '../../utils/date';
import { getNextStatuses, canDelegateTask } from '../../utils/task-helpers';

interface TaskDetailScreenProps {
  updatePath: string;
}

export function TaskDetailScreen({ updatePath }: TaskDetailScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const { isDark } = useTheme();
  const color = useIndustryColor();
  const curName = useCurrentName();
  const curRoleLabel = useCurrentRoleLabel();
  const localTask = state.tasks.find((t) => t.id === id);
  const localAudit = useTaskAudit(id || '');
  const isBackendMode = !state.isDemo && authEnabled;
  const backendDetail = useQuery(
    api.tasks.getDetail,
    isBackendMode && id ? { taskId: id as never } : 'skip'
  );
  const addNoteMutation = useMutation(api.tasks.addNote);
  const delegateTask = useMutation(api.tasks.delegate);
  const approvePendingTask = useMutation(api.tasks.approvePending);
  const verifyTask = useMutation(api.tasks.verify);
  const requestRework = useMutation(api.tasks.requestRework);
  const task = isBackendMode ? backendDetail?.task : localTask;
  const audit = isBackendMode ? backendDetail?.audit || [] : localAudit;

  const myTeam = useMyTeam();
  const allEmployees = useAllEmployees();
  const [noteText, setNoteText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateToId, setDelegateToId] = useState('');
  const [error, setError] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  if (isBackendMode && backendDetail === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <Text className="text-gray-400 dark:text-gray-500">Loading task...</Text>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <Text className="text-gray-400 dark:text-gray-500">Task not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text style={{ color }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const overdue = isOverdue(task.due, task.status);

  // In backend mode, use server-computed permissions to avoid local userId mismatch
  const canApprove = isBackendMode
    ? Boolean(backendDetail?.canApprove)
    : (state.role === 'admin' || state.role === 'subadmin') &&
      task.status === 'Pending Approval' &&
      !task.approved;
  const canVerify = isBackendMode
    ? Boolean(backendDetail?.canVerify)
    : (state.role === 'admin' || state.role === 'subadmin') &&
      task.status === 'Completed';
  const canReject = isBackendMode
    ? Boolean(backendDetail?.canRequestRework)
    : canVerify;
  const isAssignee = isBackendMode
    ? Boolean(backendDetail?.isAssignee)
    : task.assigneeId === state.userId;
  const hasStatusTransitions = isBackendMode
    ? Boolean(backendDetail?.canUpdateStatus)
    : getNextStatuses(task.status, state.role, isAssignee).length > 0;
  // Show Update Status button unless dedicated buttons (approve/verify/reject) already cover it
  const canUpdate = hasStatusTransitions && !canApprove && !canVerify;
  const showDelegateBtn = isBackendMode
    ? Boolean(backendDetail?.canDelegate)
    : task && canDelegateTask(task, state.userId || '', state.role);

  // Get accountable lead name
  const accountableLead = task?.accountableLeadName
    || (task?.accountableLeadId
      ? task.accountableLeadId === 'admin'
        ? state.onboarding.adminName
        : allEmployees.find((e) => e.id === task.accountableLeadId)?.name
      : null);

  // Delegate member options (subadmin's team members, excluding self)
  const delegateOptions: SelectOption[] = myTeam
    ? myTeam.members
        .filter((m) => m.id !== state.userId)
        .map((m) => ({ label: m.name, value: m.id }))
    : [];
  const backendDelegateOptions: SelectOption[] = (backendDetail?.teamMembers || []).map((member) => ({
    label: member.name,
    value: member.userId,
  }));
  const visibleDelegateOptions = isBackendMode ? backendDelegateOptions : delegateOptions;

  const handleDelegate = () => {
    if (!delegateToId || !task) return;
    setError('');

    if (isBackendMode) {
      void (async () => {
        setIsSubmittingStatus(true);
        try {
          const target = backendDetail?.teamMembers?.find((member) => member.userId === delegateToId);
          if (!target) {
            throw new Error('That team member is not available for delegation yet.');
          }
          await delegateTask({
            taskId: task.id as never,
            assigneeMembershipId: target.membershipId as never,
          });
          setShowDelegate(false);
          setDelegateToId('');
        } catch (delegateError) {
          setError(
            delegateError instanceof Error
              ? delegateError.message
              : 'We could not delegate that task yet.'
          );
        } finally {
          setIsSubmittingStatus(false);
        }
      })();
      return;
    }

    const emp = allEmployees.find((e) => e.id === delegateToId);
    if (!emp) return;
    const now = getNowISO();
    const today = getToday();

    dispatch({
      type: 'UPDATE_TASK',
      taskId: task.id,
      updates: {
        assignee: emp.name,
        assigneeId: emp.id,
        delegatedAt: now,
      },
    });
    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: task.id,
        role: 'SubAdmin',
        message: `Delegated to ${emp.name} by ${curName}.`,
        createdAt: now,
        dateTag: today,
        updateType: 'Delegated',
      },
    });
    setShowDelegate(false);
    setDelegateToId('');
  };

  const handleApprove = () => {
    setError('');
    if (isBackendMode) {
      void (async () => {
        setIsSubmittingStatus(true);
        try {
          await approvePendingTask({ taskId: task.id as never });
          router.back();
        } catch (approveError) {
          setError(
            approveError instanceof Error
              ? approveError.message
              : 'We could not approve that task yet.'
          );
        } finally {
          setIsSubmittingStatus(false);
        }
      })();
      return;
    }

    dispatch({ type: 'UPDATE_TASK', taskId: task.id, updates: { status: 'Open', approved: true } });
    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: task.id, role: curRoleLabel,
        message: `Approved by ${curName}. Work may proceed.`,
        createdAt: getNowISO(), dateTag: getToday(), updateType: 'Approval',
      },
    });
    router.back();
  };

  const handleVerify = () => {
    setError('');
    if (isBackendMode) {
      void (async () => {
        setIsSubmittingStatus(true);
        try {
          await verifyTask({ taskId: task.id as never });
          router.back();
        } catch (verifyError) {
          setError(
            verifyError instanceof Error
              ? verifyError.message
              : 'We could not verify that task yet.'
          );
        } finally {
          setIsSubmittingStatus(false);
        }
      })();
      return;
    }

    const wasLate = task.due && task.completedAt && task.completedAt > task.due;
    dispatch({
      type: 'UPDATE_TASK',
      taskId: task.id,
      updates: { status: 'Verified', verifiedBy: curName },
    });
    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: task.id, role: 'System',
        message: `✓ Verified & closed by ${curName}.${wasLate ? ' ⚠ Completed past due date.' : ''}`,
        createdAt: getNowISO(), dateTag: getToday(), updateType: 'Verified',
      },
    });
    router.back();
  };

  const handleRework = () => {
    setError('');
    if (isBackendMode) {
      void (async () => {
        setIsSubmittingStatus(true);
        try {
          await requestRework({
            taskId: task.id as never,
            reason: rejectReason || 'Rework required',
          });
          setShowReject(false);
          router.back();
        } catch (reworkError) {
          setError(
            reworkError instanceof Error
              ? reworkError.message
              : 'We could not request rework yet.'
          );
        } finally {
          setIsSubmittingStatus(false);
        }
      })();
      return;
    }

    dispatch({
      type: 'REWORK_TASK',
      taskId: task.id,
      reason: rejectReason || 'Rework required',
      reworkedBy: curName,
      currentRole: state.role,
    });
    setShowReject(false);
    router.back();
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setError('');

    if (isBackendMode) {
      void (async () => {
        setIsSubmittingNote(true);
        try {
          await addNoteMutation({
            taskId: task.id as never,
            message: noteText.trim(),
          });
          setNoteText('');
        } catch (noteError) {
          setError(
            noteError instanceof Error
              ? noteError.message
              : 'We could not add that note yet.'
          );
        } finally {
          setIsSubmittingNote(false);
        }
      })();
      return;
    }

    dispatch({
      type: 'ADD_AUDIT',
      entry: {
        taskId: task.id, role: curRoleLabel,
        message: noteText.trim(),
        createdAt: getNowISO(), dateTag: getToday(), updateType: 'Note',
      },
    });
    setNoteText('');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-900 px-5 py-4 flex-row items-center gap-3 border-b border-gray-100 dark:border-gray-800">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#d1d5db' : '#374151'} />
        </Pressable>
        <Text className="text-base font-bold text-gray-900 dark:text-gray-100 flex-1" numberOfLines={1}>
          Task Detail
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Task info */}
        <Card className="mx-5 mt-4">
          <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{task.title}</Text>
          {task.description ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">{task.description}</Text>
          ) : (
            <View className="mb-3" />
          )}
          <View className="flex-row gap-2 mb-4">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.reworked && (
              <View className="bg-amber-50 rounded-full px-2.5 py-0.5">
                <Text className="text-xs font-medium text-amber-700">
                  Rework ×{task.reworkCount || 1}
                </Text>
              </View>
            )}
          </View>

          <View className="gap-3">
            <InfoRow icon="person" label="Assigned to" value={task.assignee} />
            <InfoRow icon="location" label="Site" value={task.site} />
            {task.category && <InfoRow icon="pricetag" label="Category" value={task.category} />}
            <InfoRow
              icon="calendar"
              label="Due date"
              value={task.due ? formatDue(task.due) || task.due : 'No due date'}
              valueColor={overdue ? '#dc2626' : undefined}
            />
            <InfoRow icon="person-circle" label="Assigned by" value={task.assignedBy || 'Self'} />
            {accountableLead && (
              <InfoRow icon="shield-checkmark" label="Lead" value={accountableLead} />
            )}
            {task.delegatedAt && (
              <InfoRow icon="arrow-redo" label="Delegated" value={task.delegatedAt.split('T')[0]} />
            )}
            <InfoRow icon="time" label="Created" value={task.createdAt} />
          </View>

          {task.note && (
            <View className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <Text className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Instruction</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{task.note}</Text>
            </View>
          )}
        </Card>

        {/* Delegate button for subadmins */}
        {showDelegateBtn && (
          <View className="mx-5 mt-4 gap-2">
            {!showDelegate ? (
              <Button
                title="Delegate to Team Member"
                onPress={() => setShowDelegate(true)}
                color="#6366f1"
              />
            ) : (
              <Card>
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Delegate to</Text>
                <Select
                  label=""
                  placeholder="Select team member"
                  options={visibleDelegateOptions}
                  value={delegateToId}
                  onChange={setDelegateToId}
                />
                <View className="flex-row gap-2 mt-3">
                  <Button
                    title="Cancel"
                    onPress={() => { setShowDelegate(false); setDelegateToId(''); }}
                    variant="outline"
                    size="md"
                    className="flex-1"
                  />
                  <Button
                    title="Delegate"
                    onPress={handleDelegate}
                    color="#6366f1"
                    size="md"
                    className="flex-1"
                    disabled={!delegateToId || isSubmittingStatus}
                  />
                </View>
              </Card>
            )}
          </View>
        )}

        {error ? (
          <Card className="mx-5 mt-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </Card>
        ) : null}

        {/* Action buttons */}
        {(canApprove || canVerify || canReject || canUpdate) && (
          <View className="mx-5 mt-4 gap-2">
            {canApprove && (
              <Button title={isSubmittingStatus ? 'Saving...' : 'Approve Task'} onPress={handleApprove} color={color} disabled={isSubmittingStatus} />
            )}
            {canVerify && !showVerifyConfirm && (
              <Button
                title="Verify & Close"
                onPress={() => setShowVerifyConfirm(true)}
                color={color}
                disabled={isSubmittingStatus}
              />
            )}
            {showVerifyConfirm && (
              <Card>
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Are you sure you want to verify and close this task?
                </Text>
                <View className="flex-row gap-2">
                  <Button
                    title="Cancel"
                    onPress={() => setShowVerifyConfirm(false)}
                    variant="outline"
                    size="md"
                    className="flex-1"
                    disabled={isSubmittingStatus}
                  />
                  <Button
                    title={isSubmittingStatus ? 'Saving...' : 'Verify'}
                    onPress={handleVerify}
                    color={color}
                    size="md"
                    className="flex-1"
                    disabled={isSubmittingStatus}
                  />
                </View>
              </Card>
            )}
            {canReject && !showReject && (
              <Button title="Request Rework" onPress={() => setShowReject(true)} variant="danger" disabled={isSubmittingStatus} />
            )}
            {showReject && (
              <Card>
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Rework reason</Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Why is rework needed?"
                  placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
                  multiline
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 mb-3 min-h-[60px]"
                />
                <View className="flex-row gap-2">
                  <Button
                    title="Cancel"
                    onPress={() => setShowReject(false)}
                    variant="outline"
                    size="md"
                    className="flex-1"
                  />
                  <Button
                    title="Send to Rework"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        if (window.confirm('This will send the task back for rework. Continue?')) {
                          handleRework();
                        }
                      } else {
                        Alert.alert(
                          'Request Rework?',
                          'This will send the task back for rework.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Send to Rework', style: 'destructive', onPress: handleRework },
                          ]
                        );
                      }
                    }}
                    variant="danger"
                    size="md"
                    className="flex-1"
                    disabled={!rejectReason.trim() || isSubmittingStatus}
                  />
                </View>
              </Card>
            )}
            {canUpdate && (
              <Button
                title={isSubmittingStatus ? 'Saving...' : 'Update Status'}
                onPress={() => router.push(updatePath.replace('[id]', task.id) as any)}
                color={color}
                disabled={isSubmittingStatus}
              />
            )}
          </View>
        )}

        {/* Add note */}
        <Card className="mx-5 mt-4">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Add a note</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write a note..."
              placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
              className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
            />
            <Pressable
              onPress={addNote}
              disabled={!noteText.trim() || isSubmittingNote}
              className={`px-4 rounded-xl items-center justify-center ${!noteText.trim() || isSubmittingNote ? 'opacity-20' : ''}`}
              style={{ backgroundColor: color }}
            >
              <Ionicons name="send" size={16} color="white" />
            </Pressable>
          </View>
        </Card>

        {/* Audit trail */}
        <View className="mx-5 mt-4">
          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Activity
          </Text>
          <AuditTrail entries={audit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { isDark } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <Ionicons name={icon as any} size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text className="text-xs text-gray-400 dark:text-gray-500 w-20">{label}</Text>
      <Text className="text-sm text-gray-900 dark:text-gray-100 flex-1" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </View>
  );
}
