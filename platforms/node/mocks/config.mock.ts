/**
 * Helper for tests that fork on a global `config` flag.
 *
 * The content-service pattern captures the original flag in beforeEach and
 * restores it in afterEach so flag mutations don't bleed across tests. This
 * helper wraps that capture/restore so a test can scope an override cleanly.
 *
 *   import { config } from '../../../config';
 *   const restore = overrideConfig(config, { isTransactionEnabled: false });
 *   // ...run assertions...
 *   restore();  // in afterEach, or rely on captured-in-beforeEach restore
 */

/**
 * Override one or more flags on a config-like object, returning a function that
 * restores the previous values. Only the touched keys are saved/restored.
 */
export const overrideConfig = <T extends Record<string, unknown>>(
  config: T,
  overrides: Partial<T>,
): (() => void) => {
  const previous: Partial<T> = {};
  (Object.keys(overrides) as Array<keyof T>).forEach((key) => {
    previous[key] = config[key];
    (config as Record<keyof T, unknown>)[key] = overrides[key] as unknown;
  });

  return () => {
    (Object.keys(previous) as Array<keyof T>).forEach((key) => {
      (config as Record<keyof T, unknown>)[key] = previous[key] as unknown;
    });
  };
};
