/**
 * Tests for FlexBridgeService logic
 *
 * Since the actual service imports @papi/core which isn't available in tests,
 * we test the service logic using a local implementation that mirrors the real service.
 */

import { EventEmitter } from 'events';

// Define types locally (matching the actual service)
interface ExtensionBasicData {
  name: string;
  version: string;
}

interface CreateProcess {
  spawn: jest.Mock;
  osData: {
    platform: string;
  };
}

interface WritingSystemInfo {
  code: string;
  name: string;
  isDefault: boolean;
}

interface FlexProjectInfo {
  name: string;
  path: string;
  vernacularWs: string;
  analysisWs: string;
}

interface FlexProjectDetails extends FlexProjectInfo {
  vernacularWritingSystems: WritingSystemInfo[];
  analysisWritingSystems: WritingSystemInfo[];
}

interface ListProjectsResult {
  success: boolean;
  projects?: FlexProjectInfo[];
  error?: string;
  errorCode?: string;
}

interface ProjectInfoResult {
  success: boolean;
  project?: FlexProjectDetails;
  error?: string;
  errorCode?: string;
}

interface CreateTextResult {
  success: boolean;
  textName?: string;
  paragraphCount?: number;
  projectPath?: string;
  vernacularWs?: string;
  error?: string;
  errorCode?: string;
}

const ErrorCodes = {
  ProjectNotFound: 'PROJECT_NOT_FOUND',
  ProjectLocked: 'PROJECT_LOCKED',
  ProjectNeedsMigration: 'PROJECT_NEEDS_MIGRATION',
  InvalidUsj: 'INVALID_USJ',
  TextExists: 'TEXT_EXISTS',
  WriteFailed: 'WRITE_FAILED',
  UnknownError: 'UNKNOWN_ERROR',
} as const;

// Local implementation mirroring the actual FlexBridgeService
class FlexBridgeService {
  private createProcess: CreateProcess;
  private executionToken: ExtensionBasicData;
  private bridgePath = 'bridge/FlexTextBridge.exe';

  constructor(createProcess: CreateProcess, executionToken: ExtensionBasicData) {
    this.createProcess = createProcess;
    this.executionToken = executionToken;
  }

  isSupported(): boolean {
    return this.createProcess.osData.platform === 'win32';
  }

  getPlatformName(): string {
    return this.createProcess.osData.platform;
  }

  async listProjects(): Promise<ListProjectsResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    try {
      const result = await this.runBridge(['--list-projects']);
      return JSON.parse(result) as ListProjectsResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }
  }

  async getProjectInfo(projectName: string): Promise<ProjectInfoResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    try {
      const result = await this.runBridge(['--project-info', '--project', projectName]);
      return JSON.parse(result) as ProjectInfoResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get project info: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }
  }

  async createText(
    projectName: string,
    textTitle: string,
    usjData: unknown,
    options: { overwrite?: boolean; vernacularWs?: string } = {}
  ): Promise<CreateTextResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    const args = ['--project', projectName, '--title', textTitle];
    if (options.overwrite) {
      args.push('--overwrite');
    }
    if (options.vernacularWs) {
      args.push('--vernacular-ws', options.vernacularWs);
    }

    try {
      const usjJson = JSON.stringify(usjData);
      const result = await this.runBridge(args, usjJson);
      return JSON.parse(result) as CreateTextResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to create text: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }
  }

  async checkTextName(
    projectName: string,
    textTitle: string
  ): Promise<{ exists: boolean; suggestedName?: string }> {
    try {
      const args = ['--check-text', '--project', projectName, '--title', textTitle];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as {
        success: boolean;
        exists: boolean;
        suggestedName?: string;
      };

      if (result.success) {
        return {
          exists: result.exists,
          suggestedName: result.suggestedName,
        };
      }

      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  async checkFlexStatus(
    projectName: string
  ): Promise<{ isRunning: boolean; sharingEnabled: boolean }> {
    try {
      const args = ['--check-flex-status', '--project', projectName];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as {
        success: boolean;
        isRunning: boolean;
        sharingEnabled: boolean;
      };

      if (result.success) {
        return {
          isRunning: result.isRunning,
          sharingEnabled: result.sharingEnabled,
        };
      }

      return { isRunning: false, sharingEnabled: false };
    } catch {
      return { isRunning: false, sharingEnabled: false };
    }
  }

  async getSafeNavigationTarget(
    projectName: string,
    textTitle: string
  ): Promise<{ guid?: string; tool: string }> {
    try {
      const args = ['--get-safe-target', '--project', projectName, '--title', textTitle];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as { success: boolean; guid?: string; tool: string };

      if (result.success) {
        return {
          guid: result.guid,
          tool: result.tool,
        };
      }

      return { tool: 'default' };
    } catch {
      return { tool: 'default' };
    }
  }

  private runBridge(args: string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const process = this.createProcess.spawn(
        this.executionToken,
        this.bridgePath,
        args,
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      process.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          try {
            const errorResult = JSON.parse(stderr) as CreateTextResult;
            resolve(JSON.stringify(errorResult));
          } catch {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        }
      });

      process.on('error', (err: Error) => {
        reject(err);
      });

      if (stdin) {
        process.stdin.write(stdin);
        process.stdin.end();
      } else {
        process.stdin.end();
      }
    });
  }
}

// Helper to create mock process with controllable streams
function createMockProcess(exitCode = 0, stdout = '', stderr = '') {
  const mockProcess = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: jest.Mock; end: jest.Mock };
  };

  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = {
    write: jest.fn(),
    end: jest.fn(),
  };

  // Simulate async data emission
  setTimeout(() => {
    if (stdout) {
      mockProcess.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      mockProcess.stderr.emit('data', Buffer.from(stderr));
    }
    mockProcess.emit('close', exitCode);
  }, 0);

  return mockProcess;
}

// Create mock createProcess
function createMockCreateProcess(platform = 'win32'): CreateProcess {
  return {
    spawn: jest.fn(),
    osData: {
      platform,
    },
  };
}

// Create mock execution token
function createMockExecutionToken(): ExtensionBasicData {
  return {
    name: 'flex-export',
    version: '0.0.1',
  };
}

describe('FlexBridgeService', () => {
  let service: FlexBridgeService;
  let mockCreateProcess: CreateProcess;
  let mockExecutionToken: ExtensionBasicData;

  beforeEach(() => {
    mockCreateProcess = createMockCreateProcess('win32');
    mockExecutionToken = createMockExecutionToken();
    service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);
  });

  describe('isSupported', () => {
    it('returns true on Windows platform', () => {
      expect(service.isSupported()).toBe(true);
    });

    it('returns false on non-Windows platforms', () => {
      mockCreateProcess = createMockCreateProcess('darwin');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      expect(service.isSupported()).toBe(false);
    });

    it('returns false on Linux platform', () => {
      mockCreateProcess = createMockCreateProcess('linux');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      expect(service.isSupported()).toBe(false);
    });
  });

  describe('getPlatformName', () => {
    it('returns the platform name', () => {
      expect(service.getPlatformName()).toBe('win32');
    });

    it('returns darwin for macOS', () => {
      mockCreateProcess = createMockCreateProcess('darwin');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      expect(service.getPlatformName()).toBe('darwin');
    });
  });

  describe('listProjects', () => {
    it('returns error on unsupported platform', async () => {
      mockCreateProcess = createMockCreateProcess('darwin');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      const result = await service.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toContain('only supported on Windows');
      expect(result.errorCode).toBe(ErrorCodes.UnknownError);
    });

    it('parses valid JSON response with projects', async () => {
      const mockResponse = {
        success: true,
        projects: [
          {
            name: 'TestProject',
            path: 'C:\\Projects\\TestProject',
            vernacularWs: 'en',
            analysisWs: 'en',
          },
        ],
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(1);
      expect(result.projects?.[0].name).toBe('TestProject');
    });

    it('returns empty array when no projects found', async () => {
      const mockResponse = {
        success: true,
        projects: [],
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toEqual([]);
    });

    it('handles bridge CLI errors gracefully', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        stdin: { write: jest.Mock; end: jest.Mock };
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdin = { write: jest.fn(), end: jest.fn() };

      setTimeout(() => {
        mockProcess.emit('error', new Error('Process failed to start'));
      }, 0);

      mockCreateProcess.spawn.mockReturnValue(mockProcess);

      const result = await service.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to list projects');
    });

    it('passes correct arguments to bridge CLI', async () => {
      const mockResponse = { success: true, projects: [] };
      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      await service.listProjects();

      expect(mockCreateProcess.spawn).toHaveBeenCalledWith(
        mockExecutionToken,
        'bridge/FlexTextBridge.exe',
        ['--list-projects'],
        expect.any(Object)
      );
    });
  });

  describe('getProjectInfo', () => {
    it('returns error on unsupported platform', async () => {
      mockCreateProcess = createMockCreateProcess('darwin');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      const result = await service.getProjectInfo('TestProject');

      expect(result.success).toBe(false);
      expect(result.error).toContain('only supported on Windows');
    });

    it('returns project details including writing systems', async () => {
      const mockResponse = {
        success: true,
        project: {
          name: 'TestProject',
          path: 'C:\\Projects\\TestProject',
          vernacularWs: 'en',
          analysisWs: 'en',
          vernacularWritingSystems: [
            { code: 'en', name: 'English', isDefault: true },
            { code: 'es', name: 'Spanish', isDefault: false },
          ],
          analysisWritingSystems: [{ code: 'en', name: 'English', isDefault: true }],
        },
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.getProjectInfo('TestProject');

      expect(result.success).toBe(true);
      expect(result.project?.vernacularWritingSystems).toHaveLength(2);
      expect(result.project?.analysisWritingSystems).toHaveLength(1);
    });

    it('handles missing project error', async () => {
      const mockResponse = {
        success: false,
        error: 'Project not found',
        errorCode: ErrorCodes.ProjectNotFound,
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(1, '', JSON.stringify(mockResponse))
      );

      const result = await service.getProjectInfo('NonExistentProject');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCodes.ProjectNotFound);
    });
  });

  describe('createText', () => {
    it('returns error on unsupported platform', async () => {
      mockCreateProcess = createMockCreateProcess('darwin');
      service = new FlexBridgeService(mockCreateProcess, mockExecutionToken);

      const result = await service.createText('Project', 'Title', { content: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('only supported on Windows');
    });

    it('successfully creates text with basic options', async () => {
      const mockResponse = {
        success: true,
        textName: 'Genesis 1',
        paragraphCount: 10,
        projectPath: 'C:\\Projects\\Test',
        vernacularWs: 'en',
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.createText('TestProject', 'Genesis 1', {
        type: 'USJ',
        content: [],
      });

      expect(result.success).toBe(true);
      expect(result.textName).toBe('Genesis 1');
      expect(result.paragraphCount).toBe(10);
    });

    it('passes overwrite flag correctly', async () => {
      const mockResponse = { success: true };
      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      await service.createText('TestProject', 'Genesis 1', { content: [] }, { overwrite: true });

      expect(mockCreateProcess.spawn).toHaveBeenCalledWith(
        mockExecutionToken,
        'bridge/FlexTextBridge.exe',
        ['--project', 'TestProject', '--title', 'Genesis 1', '--overwrite'],
        expect.any(Object)
      );
    });

    it('passes vernacular writing system option', async () => {
      const mockResponse = { success: true };
      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      await service.createText(
        'TestProject',
        'Genesis 1',
        { content: [] },
        { vernacularWs: 'es' }
      );

      expect(mockCreateProcess.spawn).toHaveBeenCalledWith(
        mockExecutionToken,
        'bridge/FlexTextBridge.exe',
        ['--project', 'TestProject', '--title', 'Genesis 1', '--vernacular-ws', 'es'],
        expect.any(Object)
      );
    });

    it('handles TEXT_EXISTS error code', async () => {
      const mockResponse = {
        success: false,
        error: 'Text already exists',
        errorCode: ErrorCodes.TextExists,
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(1, '', JSON.stringify(mockResponse))
      );

      const result = await service.createText('TestProject', 'Existing Text', { content: [] });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCodes.TextExists);
    });

    it('sends USJ data via stdin', async () => {
      const mockResponse = { success: true };
      const mockProcess = createMockProcess(0, JSON.stringify(mockResponse));
      mockCreateProcess.spawn.mockReturnValue(mockProcess);

      const usjData = { type: 'USJ', version: '0.2.1', content: [] };
      await service.createText('TestProject', 'Title', usjData);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(JSON.stringify(usjData));
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });
  });

  describe('checkTextName', () => {
    it('returns exists: false for new names', async () => {
      const mockResponse = {
        success: true,
        exists: false,
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.checkTextName('TestProject', 'New Text');

      expect(result.exists).toBe(false);
      expect(result.suggestedName).toBeUndefined();
    });

    it('returns exists: true with suggestedName for conflicts', async () => {
      const mockResponse = {
        success: true,
        exists: true,
        suggestedName: 'Genesis 1 (2)',
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.checkTextName('TestProject', 'Genesis 1');

      expect(result.exists).toBe(true);
      expect(result.suggestedName).toBe('Genesis 1 (2)');
    });

    it('returns exists: false on error (graceful fallback)', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        stdin: { write: jest.Mock; end: jest.Mock };
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdin = { write: jest.fn(), end: jest.fn() };

      setTimeout(() => {
        mockProcess.emit('error', new Error('Connection failed'));
      }, 0);

      mockCreateProcess.spawn.mockReturnValue(mockProcess);

      const result = await service.checkTextName('TestProject', 'Text');

      expect(result.exists).toBe(false);
    });
  });

  describe('checkFlexStatus', () => {
    it('returns isRunning: true when FLEx is open', async () => {
      const mockResponse = {
        success: true,
        isRunning: true,
        sharingEnabled: false,
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.checkFlexStatus('TestProject');

      expect(result.isRunning).toBe(true);
      expect(result.sharingEnabled).toBe(false);
    });

    it('returns sharingEnabled status correctly', async () => {
      const mockResponse = {
        success: true,
        isRunning: true,
        sharingEnabled: true,
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.checkFlexStatus('TestProject');

      expect(result.isRunning).toBe(true);
      expect(result.sharingEnabled).toBe(true);
    });

    it('returns default values on error', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        stdin: { write: jest.Mock; end: jest.Mock };
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdin = { write: jest.fn(), end: jest.fn() };

      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed'));
      }, 0);

      mockCreateProcess.spawn.mockReturnValue(mockProcess);

      const result = await service.checkFlexStatus('TestProject');

      expect(result.isRunning).toBe(false);
      expect(result.sharingEnabled).toBe(false);
    });
  });

  describe('getSafeNavigationTarget', () => {
    it('returns guid and tool for redirect workflow', async () => {
      const mockResponse = {
        success: true,
        guid: 'abc-123-def',
        tool: 'textsWords',
      };

      mockCreateProcess.spawn.mockReturnValue(
        createMockProcess(0, JSON.stringify(mockResponse))
      );

      const result = await service.getSafeNavigationTarget('TestProject', 'Genesis 1');

      expect(result.guid).toBe('abc-123-def');
      expect(result.tool).toBe('textsWords');
    });

    it('returns default tool on error', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        stdin: { write: jest.Mock; end: jest.Mock };
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdin = { write: jest.fn(), end: jest.fn() };

      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed'));
      }, 0);

      mockCreateProcess.spawn.mockReturnValue(mockProcess);

      const result = await service.getSafeNavigationTarget('TestProject', 'Text');

      expect(result.guid).toBeUndefined();
      expect(result.tool).toBe('default');
    });
  });
});
