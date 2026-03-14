import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useApp } from '../../store/AppContext';
import { useIndustryColor } from '../../store/selectors';
import { useTheme } from '../../providers/ThemeProvider';
import { getToday, getNowISO } from '../../utils/date';
import { uid } from '../../utils/id';
import { useBackendAuth } from '../../providers/BackendProviders';

interface LeaveRequestSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LeaveRequestSheet({ visible, onClose }: LeaveRequestSheetProps) {
  const { state, dispatch } = useApp();
  const { authEnabled } = useBackendAuth();
  const color = useIndustryColor();
  const { isDark } = useTheme();
  const today = getToday();
  const createAvailabilityRequest = useMutation(api.availability.createRequest);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!state.userId || !state.activeWorkspaceId) return;

    setIsSubmitting(true);

    try {
      if (!state.isDemo && authEnabled) {
        await createAvailabilityRequest({
          type: 'leave',
          startDate,
          endDate,
          notes: notes.trim() || undefined,
        });
      } else {
        dispatch({
          type: 'REQUEST_AVAILABILITY',
          record: {
            id: uid(),
            organizationId: state.activeWorkspaceId,
            memberId: state.userId,
            type: 'leave',
            status: 'pending',
            startDate,
            endDate,
            notes: notes.trim(),
            requestedById: state.userId,
            approvedById: null,
            createdAt: getNowISO(),
            approvedAt: null,
          },
        });
      }

      setStartDate(today);
      setEndDate(today);
      setNotes('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = startDate >= today && endDate >= startDate;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1 bg-black/30 dark:bg-black/50" onPress={onClose} />
      <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Request Leave</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={22} color={isDark ? '#9ca3af' : '#6b7280'} />
          </Pressable>
        </View>

        {/* Start Date */}
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          Start Date
        </Text>
        <TextInput
          className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
          placeholder="YYYY-MM-DD"
          value={startDate}
          onChangeText={setStartDate}
          placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
        />

        {/* End Date */}
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          End Date
        </Text>
        <TextInput
          className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
          placeholder="YYYY-MM-DD"
          value={endDate}
          onChangeText={setEndDate}
          placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
        />

        {/* Notes */}
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          Notes (optional)
        </Text>
        <TextInput
          className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-6"
          placeholder="Reason for leave..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          placeholderTextColor={isDark ? '#4b5563' : '#d1d5db'}
        />

        {/* Submit */}
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!isValid || isSubmitting}
          className="py-3.5 rounded-2xl items-center"
          style={{ backgroundColor: isValid && !isSubmitting ? color : '#e5e7eb' }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isValid && !isSubmitting ? '#fff' : '#9ca3af' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
