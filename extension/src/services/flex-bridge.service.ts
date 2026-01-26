import type { ChildProcessByStdio } from "child_process";
import type { Readable, Writable } from "stream";
import type { ExtensionBasicData, CreateProcess } from "@papi/core";

/**
 * Writing system information
 */
export interface WritingSystemInfo {
  code: string;
  name: string;
  isDefault: boolean;
}

/**
 * FLEx project information returned by the bridge CLI (basic, from list-projects)
 */
export interface FlexProjectInfo {
  name: string;
  path: string;
  vernacularWs: string;
  analysisWs: string;
}

/**
 * Detailed FLEx project information (from project-info command)
 */
export interface FlexProjectDetails extends FlexProjectInfo {
  vernacularWritingSystems: WritingSystemInfo[];
  analysisWritingSystems: WritingSystemInfo[];
}

/**
 * Result from listing FLEx projects
 */
export interface ListProjectsResult {
  success: boolean;
  projects?: FlexProjectInfo[];
  error?: string;
  errorCode?: string;
}

/**
 * Result from getting project info
 */
export interface ProjectInfoResult {
  success: boolean;
  project?: FlexProjectDetails;
  error?: string;
  errorCode?: string;
}

/**
 * Result from creating a FLEx text
 */
export interface CreateTextResult {
  success: boolean;
  textName?: string;
  paragraphCount?: number;
  projectPath?: string;
  vernacularWs?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Error codes returned by the bridge CLI
 */
export const ErrorCodes = {
  ProjectNotFound: "PROJECT_NOT_FOUND",
  ProjectLocked: "PROJECT_LOCKED",
  ProjectNeedsMigration: "PROJECT_NEEDS_MIGRATION",
  InvalidUsj: "INVALID_USJ",
  TextExists: "TEXT_EXISTS",
  WriteFailed: "WRITE_FAILED",
  UnknownError: "UNKNOWN_ERROR",
} as const;

/**
 * Service for communicating with the FlexTextBridge CLI
 */
export class FlexBridgeService {
  private createProcess: CreateProcess;
  private executionToken: ExtensionBasicData;
  private bridgePath = "bridge/FlexTextBridge.exe";

  constructor(
    createProcess: CreateProcess,
    executionToken: ExtensionBasicData
  ) {
    this.createProcess = createProcess;
    this.executionToken = executionToken;
  }

  /**
   * Check if this platform is supported (Windows only for now)
   */
  isSupported(): boolean {
    return this.createProcess.osData.platform === "win32";
  }

  /**
   * Get the platform name for error messages
   */
  getPlatformName(): string {
    return this.createProcess.osData.platform;
  }

  /**
   * List all available FLEx projects on the system
   */
  async listProjects(): Promise<ListProjectsResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    try {
      const result = await this.runBridge(["--list-projects"]);
      return JSON.parse(result) as ListProjectsResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }
  }

  /**
   * Get detailed information about a specific FLEx project including all writing systems
   * @param projectName Name of the FLEx project
   */
  async getProjectInfo(projectName: string): Promise<ProjectInfoResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    try {
      const result = await this.runBridge([
        "--project-info",
        "--project",
        projectName,
      ]);
      return JSON.parse(result) as ProjectInfoResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get project info: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }
  }

  /**
   * Create a text in a FLEx project from USJ data
   * @param projectName Name of the FLEx project
   * @param textTitle Title for the new text
   * @param usjData USJ JSON data (array of chapters)
   * @param options Optional settings for text creation
   */
  async createText(
    projectName: string,
    textTitle: string,
    usjData: unknown,
    options: {
      overwrite?: boolean;
      vernacularWs?: string;
    } = {}
  ): Promise<CreateTextResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: `FLEx export is only supported on Windows. Current platform: ${this.getPlatformName()}`,
        errorCode: ErrorCodes.UnknownError,
      };
    }

    const args = ["--project", projectName, "--title", textTitle];
    if (options.overwrite) {
      args.push("--overwrite");
    }
    if (options.vernacularWs) {
      args.push("--vernacular-ws", options.vernacularWs);
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

  /**
   * Check if a text name exists in a FLEx project and get suggested alternative
   */
  async checkTextName(projectName: string, textTitle: string): Promise<{ exists: boolean; suggestedName?: string }> {
    try {
      const args = ["--check-text", "--project", projectName, "--title", textTitle];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as { success: boolean; exists: boolean; suggestedName?: string };

      if (result.success) {
        return {
          exists: result.exists,
          suggestedName: result.suggestedName,
        };
      }

      return { exists: false };
    } catch (error) {
      // On error, assume text doesn't exist
      return { exists: false };
    }
  }

  /**
   * Check if FLEx is running and if project sharing is enabled
   */
  async checkFlexStatus(projectName: string): Promise<{ isRunning: boolean; sharingEnabled: boolean }> {
    try {
      const args = ["--check-flex-status", "--project", projectName];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as { success: boolean; isRunning: boolean; sharingEnabled: boolean };

      if (result.success) {
        return {
          isRunning: result.isRunning,
          sharingEnabled: result.sharingEnabled,
        };
      }

      return { isRunning: false, sharingEnabled: false };
    } catch (error) {
      // On error, assume FLEx is not running
      return { isRunning: false, sharingEnabled: false };
    }
  }

  /**
   * Find a safe navigation target to redirect FLEx away from the text being overwritten
   */
  async getSafeNavigationTarget(projectName: string, textTitle: string): Promise<{ guid?: string; tool: string }> {
    try {
      const args = ["--get-safe-target", "--project", projectName, "--title", textTitle];
      const output = await this.runBridge(args);
      const result = JSON.parse(output) as { success: boolean; guid?: string; tool: string };

      if (result.success) {
        return {
          guid: result.guid,
          tool: result.tool,
        };
      }

      return { tool: "default" };
    } catch (error) {
      // On error, return default navigation
      return { tool: "default" };
    }
  }

  /**
   * Run the bridge CLI with the given arguments
   * @param args Command line arguments
   * @param stdin Optional data to send to stdin
   * @returns Promise resolving to stdout output
   */
  private runBridge(args: string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const process: ChildProcessByStdio<Writable, Readable, Readable> =
        this.createProcess.spawn(this.executionToken, this.bridgePath, args, {
          stdio: ["pipe", "pipe", "pipe"],
        });

      process.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      process.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          // Try to parse error from stderr (it should be JSON)
          try {
            const errorResult = JSON.parse(stderr) as CreateTextResult;
            resolve(JSON.stringify(errorResult));
          } catch {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        }
      });

      process.on("error", (err: Error) => {
        reject(err);
      });

      // Send stdin data if provided
      if (stdin) {
        process.stdin.write(stdin);
        process.stdin.end();
      } else {
        process.stdin.end();
      }
    });
  }
}
