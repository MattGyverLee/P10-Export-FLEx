import papi, { logger } from "@papi/backend";
import type {
  ExecutionActivationContext,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';

// Import our WebView file as a string (will be bundled)
import welcomeWebView from "./web-views/welcome.web-view?inline";

const welcomeWebViewType = "flex-export.welcome";

/**
 * WebView provider that provides the welcome WebView when requested
 */
const welcomeWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== welcomeWebViewType)
      throw new Error(
        `${welcomeWebViewType} provider received request to provide a ${savedWebView.webViewType} WebView`
      );
    return {
      ...savedWebView,
      title: "Export Text to FLEx",
      content: welcomeWebView,
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

  // Open the welcome webview automatically
  papi.webViews.openWebView(welcomeWebViewType, undefined, { existingId: "?" });

  context.registrations.add(await welcomeWebViewProviderPromise);

  logger.info("flex-export extension finished activating!");
}

export async function deactivate() {
  logger.info("flex-export extension is deactivating!");
  return true;
}
