import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../store/AppContext';
import {
  useCurrentName,
  useCurrentRoleLabel,
  useIndustryColor,
} from '../../store/selectors';
import { getNextStatuses } from '../../utils/task-helpers';
import { getToday, getNowISO } from '../../utils/date';
import { StatusBadge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { TaskStatus } from '../../types';

export function TaskUpdateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const color = useIndustryColor();
  const curName = useCurrentName();
  const curRoleLabel = useCurrentRoleLabel();

  const task = state.tasks.find((t) => t.id === id);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('');
  const [note, setNote] = useState('');

  if (!task) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Task not found</Text>
      </SafeAreaView>
    );
  }

  const nextStatuses = getNextStatuses(task.status, state.role);
  const newStatus = selectedStatus || (nextStatuses.length === 1 ? nextStatuses[0] : '');

  const handleSubmit = () => {
    if (!newStatus) return;
    const today = getToday();
    const now = getNowISO();

    const isStart = newStatus === 'In Progress' && task.status === 'Open';
    const isDone = newStatus === 'Completed';

    dispatch({
      type: 'UPDATE_TASK',
      taskId: task.id,
      updates: {
        status: newStatus,
        startedAt: isStart ? today : task.startedAt,
        completedAt: isDone ? today : task.completedAt,
      },
    });

    if (note.trim()) {
      dispatch({
        type: 'ADD_AUDIT',
        entry: {
          taskId: task.id, role: curRoleLabel, message: note.trim(),
          createdAt: now, dateTag: today, updateType: 'Progress Update',
        },
      });
    }

    if (isStart) {
      dispatch({
        type: 'ADD_AUDIT',
        entry: {
          taskId: task.id, role: 'System',
          message: `▶ Task started on ${today} by ${curName} (${curRoleLabel}). Status: Open → In Progress.`,
          createdAt: now, dateTag: today, updateType: 'Status',
        },
      });
    }

    if (isDone) {
      dispatch({
        type: 'ADD_AUDIT',
        entry: {
          taskId: task.id, role: 'System',
          message: `✓ Task completed on ${today} by ${curName} (${curRoleLabel}). Awaiting verification.`,
          createdAt: now, dateTag: today, updateType: 'Status',
        },
      });
      if (task.assignedBy) {
        dispatch({
          type: 'ADD_AUDIT',
          entry: {
            taskId: task.id, role: 'System',
            message: `📋 Notification sent to ${task.assignedBy}: "${task.title}" has been completed by ${curName}.`,
            createdAt: now, dateTag: today, updateType: 'Notification',
          },
        });
      }
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="bg-white px-5 py-4 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
        <Text className="text-base font-bold text-gray-900 flex-1">Update Task</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}>
        <Card className="mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">{task.title}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-400">Current:</Text>
            <StatusBadge status={task.status} />
          </View>
        </Card>

        {nextStatuses.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              New status
            </Text>
            <View className="flex-row gap-2">
              {nextStatuses.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSelectedStatus(s)}
                  className={`flex-1 py-3.5 rounded-xl items-center border ${
                    (selectedStatus === s || (nextStatuses.length === 1))
                      ? 'border-transparent'
                      : 'border-gray-200'
                  }`}
                  style={
                    (selectedStatus === s || nextStatuses.length === 1)
                      ? { backgroundColor: color }
                      : undefined
                  }
                >
                  <Text
                    className={`text-sm font-semibold ${
                      (selectedStatus === s || nextStatuses.length === 1)
                        ? 'text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Add a note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What progress have you made?"
            placeholderTextColor="#d1d5db"
            multiline
            numberOfLines={4}
            className="bg-white rounded-2xl px-4 py-3.5 text-sm text-gray-900 border border-gray-200 min-h-[100px]"
            textAlignVertical="top"
          />
        </View>

        <Button
          title="Submit Update"
          onPress={handleSubmit}
          disabled={!newStatus}
          color={color}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
