import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScoreBand } from '../../types';

const BAND_COLORS: Record<ScoreBand, { ring: string; bg: string; text: string }> = {
  green: { ring: '#059669', bg: '#ecfdf5', text: '#059669' },
  amber: { ring: '#d97706', bg: '#fffbeb', text: '#d97706' },
  red: { ring: '#dc2626', bg: '#fef2f2', text: '#dc2626' },
};

interface ScoreBadgeProps {
  score: number;
  band: ScoreBand;
  trendDelta?: number;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, band, trendDelta, size = 'sm' }: ScoreBadgeProps) {
  const colors = BAND_COLORS[band];
  const dim = size === 'sm' ? 32 : 48;
  const ringWidth = size === 'sm' ? 2.5 : 3;
  const fontSize = size === 'sm' ? 11 : 16;
  const trendSize = size === 'sm' ? 9 : 11;

  return (
    <View style={{ alignItems: 'center', gap: size === 'sm' ? 2 : 4 }}>
      {/* Circular score ring */}
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderWidth: ringWidth,
          borderColor: colors.ring,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize,
            fontWeight: '700',
            color: colors.text,
          }}
        >
          {score}
        </Text>
      </View>

      {/* Trend arrow */}
      {trendDelta !== undefined && trendDelta !== 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <Ionicons
            name={trendDelta > 0 ? 'arrow-up' : 'arrow-down'}
            size={trendSize}
            color={trendDelta > 0 ? '#059669' : '#dc2626'}
          />
          <Text
            style={{
              fontSize: trendSize,
              fontWeight: '600',
              color: trendDelta > 0 ? '#059669' : '#dc2626',
            }}
          >
            {Math.abs(trendDelta)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Band label helper ───────────────────────────────────────────────

const BAND_LABELS: Record<ScoreBand, string> = {
  green: 'On Track',
  amber: 'Needs Attention',
  red: 'At Risk',
};

export function BandLabel({ band }: { band: ScoreBand }) {
  const colors = BAND_COLORS[band];
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text }}>
        {BAND_LABELS[band]}
      </Text>
    </View>
  );
}
