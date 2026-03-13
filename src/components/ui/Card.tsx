import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <View className={`bg-white rounded-2xl border border-gray-100 p-4 ${className}`} {...props}>
      {children}
    </View>
  );
}
