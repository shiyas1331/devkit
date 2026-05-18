/**
 * Mock for react-native-safe-area-context.
 *
 * Copies into <package>/__mocks__/react-native-safe-area-context.tsx.
 *
 * SafeAreaProvider and SafeAreaView render their children as passthrough
 * Views. useSafeAreaInsets returns zero insets (no notch / no nav bar)
 * so tests don't depend on device geometry.
 */
import React from 'react';
import { View } from 'react-native';

export const SafeAreaProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <View>{children}</View>
);

export const SafeAreaView: React.FC<{ children?: React.ReactNode; style?: unknown; edges?: unknown; mode?: unknown }> = ({
  children,
  style,
}) => <View style={style as never}>{children}</View>;

export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });

export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
