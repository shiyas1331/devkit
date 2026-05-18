/**
 * Mock for react-native-fast-image.
 *
 * Copies into <package>/__mocks__/react-native-fast-image.tsx.
 */
import React from 'react';
import { View, Image } from 'react-native';

const FastImage: React.FC<Record<string, unknown>> = props =>
  React.createElement(Image as never, props);

// FastImage exports static constants alongside the component
(FastImage as never as Record<string, unknown>).resizeMode = {
  contain: 'contain',
  cover: 'cover',
  stretch: 'stretch',
  center: 'center',
};
(FastImage as never as Record<string, unknown>).priority = {
  low: 'low',
  normal: 'normal',
  high: 'high',
};
(FastImage as never as Record<string, unknown>).cacheControl = {
  immutable: 'immutable',
  web: 'web',
  cacheOnly: 'cacheOnly',
};

export default FastImage;
export { View as FastImageBackground };
