/**
 * Mock for @practo/self-serve.
 *
 * Copies into <package>/__mocks__/@practo/self-serve.tsx.
 *
 * Every named export becomes a View passthrough with testID=
 * `self-serve-<ExportName>`. This way:
 *   - Tests can `getByTestId('self-serve-Button')` to find the stand-in.
 *   - Press events pass through via forwardRef + standard View props.
 *
 * If a test needs richer behavior (e.g. an actual Button press simulation),
 * override per-test with `jest.mock('@practo/self-serve', () => ({...}))`.
 */
import React from 'react';

const stub = (name: string) =>
  React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    React.createElement(
      'View',
      {
        ...props,
        ref,
        testID: (props.testID as string) ?? `self-serve-${name}`,
      },
      props.children as React.ReactNode,
    ),
  );

const handler: ProxyHandler<Record<string, unknown>> = {
  get: (_, prop) => {
    if (typeof prop === 'string' && prop[0] === prop[0]?.toUpperCase()) {
      return stub(prop);
    }
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
