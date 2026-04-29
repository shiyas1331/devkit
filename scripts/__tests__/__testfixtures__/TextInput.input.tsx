import React from 'react';
import { TextInput } from 'react-native';

interface InputProps {
  placeholder: string;
  value: string;
  onChangeText: (s: string) => void;
}

export const Input = ({ placeholder, value, onChangeText }: InputProps) => (
  <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} />
);
