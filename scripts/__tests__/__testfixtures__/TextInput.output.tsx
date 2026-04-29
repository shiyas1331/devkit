import React from 'react';
import { TextInput } from 'react-native';
import { deriveTestId } from './utils/locator';

interface InputProps {
  placeholder: string;
  value: string;
  onChangeText: (s: string) => void;
  testID?: string;
  accessibilityLabel?: string;
}

export const Input = ({ placeholder, value, onChangeText, testID, accessibilityLabel }: InputProps) => (
  <TextInput
    placeholder={placeholder}
    value={value}
    onChangeText={onChangeText}
    testID={testID ?? deriveTestId(placeholder, 'input')}
    accessibilityLabel={accessibilityLabel}
  />
);
