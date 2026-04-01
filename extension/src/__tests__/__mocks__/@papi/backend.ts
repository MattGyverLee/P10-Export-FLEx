/**
 * Mock for @papi/backend module
 */

export const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockPapi = {
  commands: {
    registerCommand: jest.fn().mockResolvedValue({ dispose: jest.fn() }),
  },
  webViewProviders: {
    registerWebViewProvider: jest.fn().mockResolvedValue({ dispose: jest.fn() }),
  },
  webViews: {
    openWebView: jest.fn().mockResolvedValue('test-webview-id'),
    getOpenWebViewDefinition: jest.fn().mockResolvedValue(null),
  },
  projectDataProviders: {
    get: jest.fn().mockResolvedValue({
      getSetting: jest.fn().mockResolvedValue(undefined),
      getChapterUSJ: jest.fn().mockResolvedValue(null),
    }),
  },
  projectLookup: {
    getMetadataForAllProjects: jest.fn().mockResolvedValue([]),
  },
  localization: Promise.resolve({
    getLocalizedStrings: jest.fn().mockResolvedValue({}),
  }),
  scrollGroups: {
    getScrRef: jest.fn().mockResolvedValue({ book: 'GEN', chapterNum: 1, verseNum: 1 }),
  },
  notifications: {
    send: jest.fn(),
  },
};

export default mockPapi;
