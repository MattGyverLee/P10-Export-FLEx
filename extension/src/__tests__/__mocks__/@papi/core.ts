/**
 * Mock for @papi/core module
 */

export interface ExtensionBasicData {
  name: string;
  version: string;
}

export interface OsData {
  platform: string;
}

export interface CreateProcess {
  spawn: (...args: unknown[]) => unknown;
  osData: OsData;
}

export interface WebViewProps {
  projectId?: string;
  updateWebViewDefinition: (definition: Record<string, unknown>) => void;
  useWebViewState: <T>(key: string, defaultValue: T) => [T, (value: T) => void];
  state?: Record<string, unknown>;
}

export const createMockCreateProcess = (platform = 'win32'): CreateProcess => ({
  spawn: jest.fn(),
  osData: {
    platform,
  },
});

export const createMockExecutionToken = (): ExtensionBasicData => ({
  name: 'flex-export',
  version: '0.0.1',
});
