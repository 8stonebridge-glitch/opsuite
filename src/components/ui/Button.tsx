import { TouchableOpacity, Text, type ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  color,
  size = 'lg',
  className = '',
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'py-2 px-3' : size === 'md' ? 'py-3 px-4' : 'py-4 px-5';
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';

  const base = `rounded-2xl items-center justify-center ${sizeClass}`;
  const variants: Record<string, string> = {
    primary: 'bg-emerald-600 active:bg-emerald-700',
    secondary: 'bg-gray-100 active:bg-gray-200',
    danger: 'bg-red-600 active:bg-red-700',
    outline: 'border border-gray-200 active:bg-gray-50',
  };
  const textVariants: Record<string, string> = {
    primary: 'text-white font-semibold',
    secondary: 'text-gray-800 font-semibold',
    danger: 'text-white font-semibold',
    outline: 'text-gray-600 font-semibold',
  };

  const dynamicStyle: ViewStyle | undefined =
    color && variant === 'primary' ? { backgroundColor: color } : undefined;

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-20' : ''} ${className}`}
      style={dynamicStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Text className={`${textVariants[variant]} ${textSize}`}>{title}</Text>
    </TouchableOpacity>
  );
}
