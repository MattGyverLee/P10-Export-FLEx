import { useState } from 'react';
import { RenderOptions } from '@testing-library/react';

// Define types locally to avoid importing from service file (which imports @papi/core)
export interface WritingSystemInfo {
  code: string;
  name: string;
  isDefault: boolean;
}

export interface FlexProjectInfo {
  name: string;
  path: string;
  vernacularWs: string;
  analysisWs: string;
}

export interface FlexProjectDetails extends FlexProjectInfo {
  vernacularWritingSystems: WritingSystemInfo[];
  analysisWritingSystems: WritingSystemInfo[];
}

/**
 * Options for rendering a WebView component
 */
export interface WebViewTestOptions extends Omit<RenderOptions, 'wrapper'> {
  projectId?: string;
  initialState?: Record<string, unknown>;
  preloadedStrings?: Record<string, string>;
}

// Type for the setter function
type StateSetter<T> = (value: T) => void;

// Type for the useWebViewState return
type UseWebViewStateReturn<T> = [T, StateSetter<T>];

/**
 * Creates a mock useWebViewState hook that persists state across renders.
 *
 * This mock properly handles key changes (e.g., when projectId changes)
 * by always reading from the store using the current key, rather than
 * relying on useState's initialization which only happens on first render.
 */
export function createMockUseWebViewState(): jest.Mock {
  const stateStore = new Map<string, unknown>();

  // Create the mock implementation as a separate function
  function mockImplementation<T>(key: string, defaultValue: T): UseWebViewStateReturn<T> {
    // Initialize the key in store if not present
    if (!stateStore.has(key)) {
      stateStore.set(key, defaultValue);
    }

    // Always read the current value from the store based on the key
    // This ensures we get the correct value even when the key changes between renders
    const storedValue = stateStore.get(key) as T;

    // Use a dummy state just to trigger re-renders when the setter is called
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [, forceUpdate] = useState({});

    const setPersistedValue: StateSetter<T> = (newValue: T) => {
      stateStore.set(key, newValue);
      forceUpdate({}); // Trigger a re-render
    };

    return [storedValue, setPersistedValue];
  }

  return jest.fn(mockImplementation) as jest.Mock;
}

/**
 * Creates mock WebView props for testing
 */
export function createMockWebViewProps(options: WebViewTestOptions = {}) {
  const projectId = options.projectId ?? 'test-project-id';
  const initialState = options.initialState ?? {};
  const preloadedStrings = options.preloadedStrings ?? {};

  const mockUseWebViewState = createMockUseWebViewState();

  return {
    projectId,
    updateWebViewDefinition: jest.fn(),
    useWebViewState: mockUseWebViewState,
    state: {
      preloadedStrings,
      scrRef: { book: 'GEN', chapterNum: 1, verseNum: 1 },
      ...initialState,
    },
    mockUseWebViewState,
  };
}

/**
 * Factory function to create a mock FLEx project
 */
export function createMockFlexProject(overrides: Partial<FlexProjectInfo> = {}): FlexProjectInfo {
  return {
    name: 'TestProject',
    path: 'C:\\ProgramData\\SIL\\FieldWorks\\Projects\\TestProject',
    vernacularWs: 'en',
    analysisWs: 'en',
    ...overrides,
  };
}

/**
 * Factory function to create mock FLEx project details with writing systems
 */
export function createMockFlexProjectDetails(
  overrides: Partial<FlexProjectDetails> = {}
): FlexProjectDetails {
  return {
    name: 'TestProject',
    path: 'C:\\ProgramData\\SIL\\FieldWorks\\Projects\\TestProject',
    vernacularWs: 'en',
    analysisWs: 'en',
    vernacularWritingSystems: [
      { code: 'en', name: 'English', isDefault: true },
      { code: 'es', name: 'Spanish', isDefault: false },
    ],
    analysisWritingSystems: [{ code: 'en', name: 'English', isDefault: true }],
    ...overrides,
  };
}

/**
 * Factory function to create a mock USJ chapter
 */
export function createMockUSJChapter(
  chapterNum: number,
  content: unknown[] = []
): { type: string; version: string; content: unknown[] } {
  return {
    type: 'USJ',
    version: '0.2.1',
    content: [
      { type: 'chapter', marker: 'c', number: String(chapterNum) },
      {
        type: 'para',
        marker: 'p',
        content: [
          { type: 'verse', marker: 'v', number: '1' },
          'In the beginning God created the heavens and the earth.',
          ...content,
        ],
      },
    ],
  };
}

/**
 * Factory function to create mock USJ with footnotes
 */
export function createMockUSJWithFootnote(chapterNum: number): unknown {
  return {
    type: 'USJ',
    version: '0.2.1',
    content: [
      { type: 'chapter', marker: 'c', number: String(chapterNum) },
      {
        type: 'para',
        marker: 'p',
        content: [
          { type: 'verse', marker: 'v', number: '1' },
          'In the beginning',
          {
            type: 'note',
            marker: 'f',
            caller: '+',
            content: [{ type: 'char', marker: 'ft', content: ['This is a footnote'] }],
          },
          ' God created the heavens and the earth.',
        ],
      },
    ],
  };
}

/**
 * Factory function to create mock USJ with cross-references
 */
export function createMockUSJWithCrossRef(chapterNum: number): unknown {
  return {
    type: 'USJ',
    version: '0.2.1',
    content: [
      { type: 'chapter', marker: 'c', number: String(chapterNum) },
      {
        type: 'para',
        marker: 'p',
        content: [
          { type: 'verse', marker: 'v', number: '1' },
          'In the beginning',
          {
            type: 'note',
            marker: 'x',
            caller: '+',
            content: [{ type: 'char', marker: 'xt', content: ['John 1:1'] }],
          },
          ' God created the heavens and the earth.',
        ],
      },
    ],
  };
}

/**
 * Factory function to create mock USJ with introduction
 */
export function createMockUSJWithIntro(chapterNum: number): unknown {
  return {
    type: 'USJ',
    version: '0.2.1',
    content: [
      { type: 'para', marker: 'imt', content: ['Introduction to Genesis'] },
      { type: 'para', marker: 'ip', content: ['This is introduction paragraph.'] },
      { type: 'chapter', marker: 'c', number: String(chapterNum) },
      {
        type: 'para',
        marker: 'p',
        content: [
          { type: 'verse', marker: 'v', number: '1' },
          'In the beginning God created the heavens and the earth.',
        ],
      },
    ],
  };
}

/**
 * Factory function to create mock writing system info
 */
export function createMockWritingSystem(overrides: Partial<WritingSystemInfo> = {}): WritingSystemInfo {
  return {
    code: 'en',
    name: 'English',
    isDefault: true,
    ...overrides,
  };
}

/**
 * Helper to wait for async updates in components
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Note: Import @testing-library/react directly in test files
