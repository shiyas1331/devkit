import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface EstItemProps {
  estName: string;
  onPress: () => void;
}

export const EstItem = ({ estName, onPress }: EstItemProps) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{estName}</Text>
  </TouchableOpacity>
);
