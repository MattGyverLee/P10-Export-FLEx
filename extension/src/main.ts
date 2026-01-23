import papi, { logger } from "@papi/backend";
import type {
  ExecutionActivationContext,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';
import type { SerializedVerseRef } from '@sillsdev/scripture';
import { FlexBridgeService, type FlexProjectInfo, type FlexProjectDetails, type CreateTextResult } from './services/flex-bridge.service';

// Import our WebView file as a string (will be bundled)
import welcomeWebView from "./web-views/welcome.web-view?inline";

// Bridge service instance (initialized during activation)
let flexBridge: FlexBridgeService | undefined;

const welcomeWebViewType = "flex-export.welcome";

/** Options for opening the Export to FLEx WebView */
interface ExportToFlexWebViewOptions extends GetWebViewOptions {
  projectId?: string;
  initialScrRef?: SerializedVerseRef;
}

/**
 * WebView provider that provides the welcome WebView when requested
 */
const welcomeWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition,
    getWebViewOptions: ExportToFlexWebViewOptions
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== welcomeWebViewType)
      throw new Error(
        `${welcomeWebViewType} provider received request to provide a ${savedWebView.webViewType} WebView`
      );

    // Use projectId from options, falling back to saved state
    const projectId = getWebViewOptions.projectId || savedWebView.projectId || undefined;

    // Use initial scripture reference from options, falling back to saved state
    const initialScrRef = getWebViewOptions.initialScrRef || savedWebView.state?.initialScrRef;

    return {
      ...savedWebView,
      title: "Export Text to FLEx",
      content: welcomeWebView,
      projectId,
      state: {
        ...savedWebView.state,
        initialScrRef,
      },
    };
  },
};

export async function activate(context: ExecutionActivationContext) {
  logger.info("flex-export extension is activating!");

  // Initialize the FLEx bridge service if createProcess privilege is available
  const { createProcess } = context.elevatedPrivileges;
  if (createProcess) {
    flexBridge = new FlexBridgeService(createProcess, context.executionToken);
    if (flexBridge.isSupported()) {
      logger.info("FlexBridge service initialized for Windows platform");
    } else {
      logger.warn(`FlexBridge not supported on platform: ${flexBridge.getPlatformName()}`);
    }
  } else {
    logger.warn("createProcess privilege not available - FLEx export will not work");
  }

  // Register the welcome webview provider
  const welcomeWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    welcomeWebViewType,
    welcomeWebViewProvider
  );

  // Register command to open the export dialog
  // When invoked from a WebView menu, webViewId is passed automatically as the first argument
  const openExportDialogPromise = papi.commands.registerCommand(
    "flexExport.openExportDialog",
    async (webViewId?: string) => {
      let projectId: string | undefined;
      let initialScrRef: SerializedVerseRef | undefined;

      // If invoked from a WebView, get the project and current scripture reference
      if (webViewId) {
        const webViewDefinition = await papi.webViews.getOpenWebViewDefinition(webViewId);

        if (webViewDefinition) {
          const sourceProjectId = webViewDefinition.projectId;

          // Only auto-select the project if it's editable (not a resource)
          if (sourceProjectId) {
            try {
              const pdp = await papi.projectDataProviders.get("platform.base", sourceProjectId);
              const isEditable = await pdp.getSetting("platform.isEditable");
              if (isEditable) {
                projectId = sourceProjectId;
              } else {
                // Show info notification that resources cannot be exported
                papi.notifications.send({
                  message: "%flexExport_resourceNotExportable%",
                  severity: "info",
                });
              }
            } catch {
              // If we can't check, don't auto-select the project
            }
          }

          // Get the scripture reference from the scroll group
          // scrollGroupScrRef can be either a number (scroll group ID) or a SerializedVerseRef
          const scrollGroupScrRef = webViewDefinition.scrollGroupScrRef;

          if (typeof scrollGroupScrRef === 'number') {
            // It's a scroll group ID - look up the scripture reference
            initialScrRef = await papi.scrollGroups.getScrRef(scrollGroupScrRef);
          } else if (typeof scrollGroupScrRef === 'object' && scrollGroupScrRef && 'book' in scrollGroupScrRef) {
            // It's a SerializedVerseRef directly
            initialScrRef = scrollGroupScrRef as SerializedVerseRef;
          } else {
            // Default to scroll group 0 if no scroll group is defined
            initialScrRef = await papi.scrollGroups.getScrRef(0);
          }
        }
      }

      const options: ExportToFlexWebViewOptions = {
        projectId,
        initialScrRef,
      };

      return papi.webViews.openWebView(welcomeWebViewType, undefined, { existingId: "?", ...options });
    }
  );

  // Register command to list FLEx projects
  const listFlexProjectsPromise = papi.commands.registerCommand(
    "flexExport.listFlexProjects",
    async (): Promise<FlexProjectInfo[]> => {
      if (!flexBridge) {
        logger.error("FlexBridge not initialized");
        return [];
      }

      const result = await flexBridge.listProjects();
      if (!result.success) {
        logger.error(`Failed to list FLEx projects: ${result.error}`);
        return [];
      }

      return result.projects ?? [];
    }
  );

  // Register command to get detailed project info (including all writing systems)
  const getFlexProjectInfoPromise = papi.commands.registerCommand(
    "flexExport.getFlexProjectInfo",
    async (projectName: string): Promise<FlexProjectDetails | undefined> => {
      if (!flexBridge) {
        logger.error("FlexBridge not initialized");
        return undefined;
      }

      const result = await flexBridge.getProjectInfo(projectName);
      if (!result.success) {
        logger.error(`Failed to get FLEx project info: ${result.error}`);
        return undefined;
      }

      return result.project;
    }
  );

  // Register command to export text to FLEx
  const exportToFlexPromise = papi.commands.registerCommand(
    "flexExport.exportToFlex",
    async (
      flexProjectName: string,
      textTitle: string,
      usjData: unknown,
      options: { overwrite?: boolean; vernacularWs?: string } = {}
    ): Promise<CreateTextResult> => {
      if (!flexBridge) {
        return {
          success: false,
          error: "FlexBridge not initialized",
          errorCode: "UNKNOWN_ERROR",
        };
      }

      logger.info(`Exporting to FLEx project "${flexProjectName}" with title "${textTitle}"`);
      const result = await flexBridge.createText(flexProjectName, textTitle, usjData, options);

      if (result.success) {
        logger.info(`Successfully created text "${textTitle}" with ${result.paragraphCount} paragraphs`);
      } else {
        logger.error(`Failed to export to FLEx: ${result.error}`);
      }

      return result;
    }
  );

  context.registrations.add(await welcomeWebViewProviderPromise);
  context.registrations.add(await openExportDialogPromise);
  context.registrations.add(await listFlexProjectsPromise);
  context.registrations.add(await getFlexProjectInfoPromise);
  context.registrations.add(await exportToFlexPromise);

  logger.info("flex-export extension finished activating!");
}

export async function deactivate() {
  logger.info("flex-export extension is deactivating!");
  return true;
}
