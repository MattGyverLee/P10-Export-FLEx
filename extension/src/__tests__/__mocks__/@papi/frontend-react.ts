/**
 * Mock for @papi/frontend/react module
 */

import { useState } from 'react';

// Mock useLocalizedStrings - returns empty object that merges with fallbacks
export const useLocalizedStrings = jest.fn(
  (_keys: string[]): [Record<string, string>] => [{}]
);

// Mock useProjectSetting
export const useProjectSetting = jest.fn(
  <T>(_projectId: string | undefined, _key: string, defaultValue: T): [T] => [
    defaultValue,
  ]
);

// Mock useSetting
export const useSetting = jest.fn(
  <T>(_key: string, defaultValue: T): [T, (value: T) => void] => {
    const [value, setValue] = useState<T>(defaultValue);
    return [value, setValue];
  }
);

/**
 * Creates a mock useWebViewState hook that uses real useState internally
 * but also tracks values in an external store for persistence testing
 */
export const createMockUseWebViewState = () => {
  const stateStore = new Map<string, unknown>();

  const mockHook = jest.fn(
    <T>(key: string, defaultValue: T): [T, (value: T) => void] => {
      const initialValue = stateStore.has(key)
        ? (stateStore.get(key) as T)
        : defaultValue;

      const [value, setValue] = useState<T>(initialValue);

      const setPersistedValue = (newValue: T) => {
        stateStore.set(key, newValue);
        setValue(newValue);
      };

      return [value, setPersistedValue];
    }
  );

  // Expose the store for assertions
  (mockHook as unknown as { getStore: () => Map<string, unknown> }).getStore =
    () => stateStore;

  return mockHook;
};

// Default export of all hooks
export default {
  useLocalizedStrings,
  useProjectSetting,
  useSetting,
};
