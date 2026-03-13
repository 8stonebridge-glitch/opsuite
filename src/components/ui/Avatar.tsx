import { View, Text } from 'react-native';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ name, color = '#059669', size = 'md' }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'md' ? 'h-10 w-10' : 'h-12 w-12';
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';
  const radius = size === 'sm' ? 'rounded-xl' : 'rounded-2xl';

  return (
    <View
      className={`${sizeClass} ${radius} items-center justify-center`}
      style={{ backgroundColor: color }}
    >
      <Text className={`text-white font-bold ${textSize}`}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
