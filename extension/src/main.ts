import papi, { logger } from "@papi/backend";
import type {
  ExecutionActivationContext,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';
import type { SerializedVerseRef } from '@sillsdev/scripture';

// Import our WebView file as a string (will be bundled)
import welcomeWebView from "./web-views/welcome.web-view?inline";

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

  // Register the welcome webview provider
  const welcomeWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    welcomeWebViewType,
    welcomeWebViewProvider
  );

  // Register command to open the export dialog
  // When invoked from a WebView menu, webViewId is passed automatically
  const openExportDialogPromise = papi.commands.registerCommand(
    "flexExport.openExportDialog",
    async (webViewId?: string) => {
      let projectId: string | undefined;
      let initialScrRef: SerializedVerseRef | undefined;

      // If invoked from a WebView, get the project and current scripture reference
      if (webViewId) {
        const webViewDefinition = await papi.webViews.getOpenWebViewDefinition(webViewId);
        if (webViewDefinition) {
          projectId = webViewDefinition.projectId;
          // Get the scripture reference from the scroll group
          const scrollGroupScrRef = webViewDefinition.scrollGroupScrRef;
          if (scrollGroupScrRef && typeof scrollGroupScrRef === 'object' && 'scrRef' in scrollGroupScrRef) {
            initialScrRef = scrollGroupScrRef.scrRef as SerializedVerseRef;
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

  context.registrations.add(await welcomeWebViewProviderPromise);
  context.registrations.add(await openExportDialogPromise);

  logger.info("flex-export extension finished activating!");
}

export async function deactivate() {
  logger.info("flex-export extension is deactivating!");
  return true;
}
