import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../store/AppContext';
import { useIndustryColor } from '../../store/selectors';
import { getToday, getNowISO } from '../../utils/date';
import { uid } from '../../utils/id';

interface LeaveRequestSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LeaveRequestSheet({ visible, onClose }: LeaveRequestSheetProps) {
  const { state, dispatch } = useApp();
  const color = useIndustryColor();
  const today = getToday();

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!state.userId || !state.activeWorkspaceId) return;

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

    // Reset and close
    setStartDate(today);
    setEndDate(today);
    setNotes('');
    onClose();
  };

  const isValid = startDate >= today && endDate >= startDate;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1 bg-black/30" onPress={onClose} />
      <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-base font-bold text-gray-900">Request Leave</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </Pressable>
        </View>

        {/* Start Date */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Start Date
        </Text>
        <TextInput
          className="bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900 mb-4"
          placeholder="YYYY-MM-DD"
          value={startDate}
          onChangeText={setStartDate}
          placeholderTextColor="#d1d5db"
        />

        {/* End Date */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          End Date
        </Text>
        <TextInput
          className="bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900 mb-4"
          placeholder="YYYY-MM-DD"
          value={endDate}
          onChangeText={setEndDate}
          placeholderTextColor="#d1d5db"
        />

        {/* Notes */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Notes (optional)
        </Text>
        <TextInput
          className="bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900 mb-6"
          placeholder="Reason for leave..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          placeholderTextColor="#d1d5db"
        />

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid}
          className="py-3.5 rounded-2xl items-center"
          style={{ backgroundColor: isValid ? color : '#e5e7eb' }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isValid ? '#fff' : '#9ca3af' }}
          >
            Submit Request
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
