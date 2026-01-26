declare module 'flex-export' {
  /**
   * FLEx project information
   */
  export interface FlexProjectInfo {
    /** Name of the FLEx project */
    name: string;
    /** Full path to the project folder */
    path: string;
    /** Vernacular writing system code */
    vernacularWs: string;
    /** Analysis writing system code */
    analysisWs: string;
  }

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
    /** Error message (on failure) */
    error?: string;
    /** Error code (on failure) */
    errorCode?: string;
  }
}

declare module 'papi-shared-types' {
  import type { FlexProjectInfo, CreateTextResult } from 'flex-export';

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
     * Exports scripture text to a FLEx project
     * @param flexProjectName Name of the FLEx project to export to
     * @param textTitle Title for the new text in FLEx
     * @param usjData USJ data (array of chapters) to export
     * @param overwrite If true, overwrite existing text with the same name
     * @returns Result of the export operation
     */
    'flexExport.exportToFlex': (
      flexProjectName: string,
      textTitle: string,
      usjData: unknown,
      overwrite?: boolean
    ) => Promise<CreateTextResult>;
  }

  // Extension preferences are stored in WebView state, not project settings
  // This avoids polluting shared project settings with extension-specific data
}
