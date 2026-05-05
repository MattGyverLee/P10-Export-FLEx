declare module 'flex-export' {
  /**
   * Writing system entry returned by the bridge for a FLEx project.
   */
  export interface WritingSystemInfo {
    code: string;
    name: string;
    isDefault: boolean;
  }

  /**
   * FLEx project information. Both --list-projects and --project-info return
   * full WS arrays (the bridge reads them from .fwdata XML directly).
   */
  export interface FlexProjectInfo {
    /** Name of the FLEx project */
    name: string;
    /** Full path to the project folder */
    path: string;
    /** Default vernacular writing system code */
    vernacularWs: string;
    /** Default analysis writing system code */
    analysisWs: string;
    /** All vernacular writing systems available in the project */
    vernacularWritingSystems: WritingSystemInfo[];
    /** All analysis writing systems available in the project */
    analysisWritingSystems: WritingSystemInfo[];
  }

  /** Alias kept for call sites that distinguish list vs detail responses. */
  export type FlexProjectDetails = FlexProjectInfo;

  /**
   * Result from creating a FLEx text
   */
  export interface CreateTextResult {
    /** Whether the operation succeeded */
    success: boolean;
    /** Name of the created text (on success) */
    textName?: string;
    /** Number of paragraphs created (on success) */
    paragraphCount?: number;
    /** Path to the FLEx project (on success) */
    projectPath?: string;
    /** Vernacular writing system code that was used (on success) */
    vernacularWs?: string;
    /** Error message (on failure) */
    error?: string;
    /** Error code (on failure) */
    errorCode?: string;
  }

  /**
   * Result from verifying a text by GUID after creation.
   */
  export interface VerifyTextResult {
    success: boolean;
    guid?: string;
    textName?: string;
    isAccessible: boolean;
    hasContent: boolean;
    paragraphCount: number;
    error?: string;
    errorCode?: string;
  }

  /**
   * Status of FLEx process and project sharing
   */
  export interface FlexStatus {
    /** Whether FLEx is running */
    isRunning: boolean;
    /** Whether project sharing is enabled */
    sharingEnabled: boolean;
  }
}

declare module 'papi-shared-types' {
  import type {
    FlexProjectInfo,
    FlexProjectDetails,
    CreateTextResult,
    FlexStatus,
    VerifyTextResult,
  } from 'flex-export';

  export interface CommandHandlers {
    /**
     * Opens the Export to FLEx dialog
     * @param webViewId Optional ID of the source WebView (auto-populated when called from menu)
     * @returns The WebView ID of the opened dialog
     */
    'flexExport.openExportDialog': (webViewId?: string) => Promise<string | undefined>;

    /**
     * Lists all available FLEx projects on the system
     * @returns Array of FLEx project information
     */
    'flexExport.listFlexProjects': () => Promise<FlexProjectInfo[]>;

    /**
     * Get detailed info (writing systems, etc.) for a single FLEx project.
     * Cached for 5 minutes per project name.
     */
    'flexExport.getFlexProjectInfo': (
      projectName: string
    ) => Promise<FlexProjectDetails | undefined>;

    /**
     * Exports scripture text to a FLEx project
     * @param flexProjectName Name of the FLEx project to export to
     * @param textTitle Title for the new text in FLEx
     * @param usjData USJ data (array of chapters) to export
     * @param options overwrite + optional vernacularWs override
     * @returns Result of the export operation
     */
    'flexExport.exportToFlex': (
      flexProjectName: string,
      textTitle: string,
      usjData: unknown,
      options?: { overwrite?: boolean; vernacularWs?: string }
    ) => Promise<CreateTextResult>;

    /**
     * Checks if FLEx is running and if project sharing is enabled
     * @param flexProjectName Name of the FLEx project
     * @returns Status of FLEx process and project sharing
     */
    'flexExport.checkFlexStatus': (flexProjectName: string) => Promise<FlexStatus>;

    /**
     * Checks if a text name exists and gets a suggested alternative
     * @param flexProjectName Name of the FLEx project
     * @param textTitle Title to check
     * @returns Whether the text exists and a suggested name if it does
     */
    'flexExport.checkTextName': (
      flexProjectName: string,
      textTitle: string
    ) => Promise<{ exists: boolean; suggestedName?: string }>;

    /**
     * Verify a text exists and is accessible by GUID after creation.
     * Used to confirm the FLEx write completed before declaring success.
     */
    'flexExport.verifyText': (
      flexProjectName: string,
      textGuid: string
    ) => Promise<VerifyTextResult>;
  }

  // Extension preferences are stored in WebView state, not project settings
  // This avoids polluting shared project settings with extension-specific data
}
