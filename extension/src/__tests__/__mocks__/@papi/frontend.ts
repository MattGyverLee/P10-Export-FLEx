/**
 * Mock for @papi/frontend module
 */

const mockPapi = {
  commands: {
    sendCommand: jest.fn(),
  },
  projectLookup: {
    getMetadataForAllProjects: jest.fn().mockResolvedValue([]),
  },
  projectDataProviders: {
    get: jest.fn().mockResolvedValue({
      getSetting: jest.fn().mockResolvedValue(undefined),
      getChapterUSJ: jest.fn().mockResolvedValue(null),
    }),
  },
  scrollGroups: {
    getScrRef: jest.fn().mockResolvedValue({ book: 'GEN', chapterNum: 1, verseNum: 1 }),
  },
  notifications: {
    send: jest.fn(),
  },
};

export default mockPapi;

// Helper to configure mock command responses
export function configureMockCommands(
  commandResponses: Record<string, unknown>
): void {
  mockPapi.commands.sendCommand.mockImplementation(
    (command: string, ...args: unknown[]) => {
      if (command in commandResponses) {
        const response = commandResponses[command];
        return Promise.resolve(
          typeof response === 'function' ? response(...args) : response
        );
      }
      return Promise.reject(new Error(`Unknown command: ${command}`));
    }
  );
}

// Helper to reset all mocks
export function resetMocks(): void {
  mockPapi.commands.sendCommand.mockReset();
  mockPapi.projectLookup.getMetadataForAllProjects.mockReset();
  mockPapi.projectDataProviders.get.mockReset();
}
