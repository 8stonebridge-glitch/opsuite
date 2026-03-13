import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreBadge, BandLabel } from './ScoreBadge';
import type { EmployeePerformance, ScoreBand } from '../../types';

const SEVERITY_DOT: Record<ScoreBand, string> = {
  red: '#dc2626',
  amber: '#d97706',
  green: '#059669',
};

interface PerformanceCardProps {
  performance: EmployeePerformance;
  /** Compact mode shows score + top 2 actions only (for employee my-day) */
  compact?: boolean;
  color?: string;
}

export function PerformanceCard({ performance, compact, color = '#059669' }: PerformanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { score, band, trendDelta, metrics, actions } = performance;

  const displayActions = compact ? actions.slice(0, 2) : actions;

  return (
    <View
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: SEVERITY_DOT[band] }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <ScoreBadge score={score} band={band} trendDelta={trendDelta} size={compact ? 'md' : 'md'} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {compact ? 'My Performance' : 'Performance Score'}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <BandLabel band={band} />
            {trendDelta !== 0 && (
              <Text className="text-[10px] text-gray-400">
                {trendDelta > 0 ? '▲' : '▼'} {Math.abs(trendDelta)} from last week
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Metric breakdown (expandable) */}
      {!compact && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          className="flex-row items-center justify-between px-4 py-2 border-t border-gray-50"
        >
          <Text className="text-xs font-medium text-gray-500">Score Breakdown</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
        </Pressable>
      )}

      {expanded && !compact && (
        <View className="px-4 pb-3">
          {/* Execution */}
          <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Execution (50%)
          </Text>
          <MetricRow label="Overdue rate" value={`${Math.round(metrics.overdueRate * 100)}%`} good={metrics.overdueRate === 0} />
          <MetricRow label="On-time completion" value={`${Math.round(metrics.onTimeCompletionRate * 100)}%`} good={metrics.onTimeCompletionRate >= 0.8} />
          <MetricRow label="Critical response" value={`${Math.round(metrics.criticalResponseRate * 100)}%`} good={metrics.criticalResponseRate >= 0.8} />
          <MetricRow label="Stale tasks" value={`${metrics.staleActiveCount}`} good={metrics.staleActiveCount === 0} />

          {/* Discipline */}
          <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">
            Discipline (50%)
          </Text>
          <MetricRow label="Check-in compliance" value={`${Math.round(metrics.checkInComplianceRate * 100)}%`} good={metrics.checkInComplianceRate >= 0.8} />
          <MetricRow label="Update consistency" value={`${Math.round(metrics.updateConsistencyRate * 100)}%`} good={metrics.updateConsistencyRate >= 0.8} />
          <MetricRow label="Rework rate" value={`${Math.round(metrics.reworkRate * 100)}%`} good={metrics.reworkRate <= 0.2} />
          <MetricRow label="Handoff response" value={`${Math.round(metrics.handoffResponseRate * 100)}%`} good={metrics.handoffResponseRate >= 0.8} />
        </View>
      )}

      {/* Action items */}
      {displayActions.length > 0 && (
        <View className="border-t border-gray-50 px-4 py-2">
          {compact && (
            <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Improve your score
            </Text>
          )}
          {displayActions.map((action) => (
            <View key={action.id} className="flex-row items-center gap-2 py-1">
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: SEVERITY_DOT[action.severity],
                }}
              />
              <Text className="text-xs text-gray-700 flex-1" numberOfLines={1}>
                {action.label}
              </Text>
              <Text className="text-[10px] text-gray-400">{action.target}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Metric row helper ───────────────────────────────────────────────

function MetricRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className={`text-xs font-medium ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
        {value}
      </Text>
    </View>
  );
}
