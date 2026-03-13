import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreBadge } from './ScoreBadge';
import { useAllEmployees } from '../../store/selectors';
import type { EmployeePerformance } from '../../types';

interface AtRiskSectionProps {
  employees: EmployeePerformance[];
  limit?: number;
}

export function AtRiskSection({ employees, limit = 5 }: AtRiskSectionProps) {
  if (employees.length === 0) return null;

  const allEmployees = useAllEmployees();
  const preview = employees.slice(0, limit);

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name="warning" size={14} color="#d97706" />
        <Text className="text-xs font-semibold uppercase tracking-wider text-amber-600">
          At-Risk Employees · {employees.length}
        </Text>
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {preview.map((perf, idx) => {
          const emp = allEmployees.find((e) => e.id === perf.employeeId);
          const topAction = perf.actions[0];
          const isLast = idx === preview.length - 1;

          return (
            <View
              key={perf.employeeId}
              className={`flex-row items-center px-3 py-2.5 ${!isLast ? 'border-b border-gray-50' : ''}`}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#f3f4f6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280' }}>
                  {(emp?.name || '?').charAt(0)}
                </Text>
              </View>

              {/* Name + action */}
              <View className="flex-1 mr-2">
                <Text className="text-sm text-gray-900" numberOfLines={1}>
                  {emp?.name || 'Unknown'}
                </Text>
                {topAction && (
                  <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                    {topAction.label} — {topAction.target}
                  </Text>
                )}
              </View>

              {/* Score badge */}
              <ScoreBadge score={perf.score} band={perf.band} size="sm" />
            </View>
          );
        })}
      </View>

      {employees.length > limit && (
        <Text className="text-[10px] text-gray-400 text-center mt-1">
          +{employees.length - limit} more
        </Text>
      )}
    </View>
  );
}
