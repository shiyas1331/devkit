import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { type ButtonProps } from './ButtonTypes';

export const Button = ({ text, onPress }: ButtonProps) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{text}</Text>
  </TouchableOpacity>
);
