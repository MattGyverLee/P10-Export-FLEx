import { Button } from "platform-bible-react";

globalThis.webViewComponent = function WelcomeWebView() {
  return (
    <div className="tw-p-8 tw-bg-gradient-to-br tw-from-blue-50 tw-to-indigo-100 tw-min-h-screen tw-flex tw-items-center tw-justify-center">
      <div className="tw-bg-white tw-rounded-lg tw-shadow-xl tw-p-8 tw-max-w-2xl tw-w-full">
        <div className="tw-text-center tw-mb-8">
          <h1 className="tw-text-4xl tw-font-bold tw-text-blue-600 tw-mb-4">
            🎉 Welcome to Your Extension!
          </h1>
          <p className="tw-text-xl tw-text-gray-600 tw-mb-2">
            Congratulations! Your Platform.Bible extension is working perfectly.
          </p>
          <p className="tw-text-lg tw-text-gray-500">
            You're now ready to start building amazing features for Platform.Bible.
          </p>
        </div>
        
        <div className="tw-bg-gray-50 tw-rounded-lg tw-p-6 tw-mb-6">
          <h2 className="tw-text-2xl tw-font-semibold tw-text-gray-800 tw-mb-4">
            🚀 Next Steps:
          </h2>
          <ol className="tw-list-decimal tw-list-inside tw-space-y-3 tw-text-gray-700">
            <li className="tw-text-base">
              <strong>Edit this webview:</strong> Modify <code className="tw-bg-white tw-px-2 tw-py-1 tw-rounded tw-text-sm">src/web-views/welcome.web-view.tsx</code> to create your own UI
            </li>
            <li className="tw-text-base">
              <strong>Add extension logic:</strong> Update <code className="tw-bg-white tw-px-2 tw-py-1 tw-rounded tw-text-sm">src/main.ts</code> to add functionality
            </li>
            <li className="tw-text-base">
              <strong>Watch for changes:</strong> Run <code className="tw-bg-white tw-px-2 tw-py-1 tw-rounded tw-text-sm">npm run watch</code> for live development
            </li>
            <li className="tw-text-base">
              <strong>Test your extension:</strong> Use <code className="tw-bg-white tw-px-2 tw-py-1 tw-rounded tw-text-sm">cd ../paranext-core && npm start</code>
            </li>
          </ol>
        </div>
        
        <div className="tw-bg-blue-50 tw-rounded-lg tw-p-6 tw-mb-6">
          <h3 className="tw-text-lg tw-font-semibold tw-text-blue-800 tw-mb-3">
            📚 Development Resources:
          </h3>
          <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-blue-700">
            <li>Platform.Bible Documentation: <a href="#" className="tw-underline">docs.platform.bible</a></li>
            <li>Extension API Reference: Check the types in your <code>src/types/</code> directory</li>
            <li>React Components: Use components from <code>platform-bible-react</code></li>
            <li>Styling: Utility-first CSS with Tailwind (prefix classes with <code>tw-</code>)</li>
          </ul>
        </div>
        
        <div className="tw-text-center">
          <Button className="tw-bg-blue-600 tw-text-white tw-px-6 tw-py-3 tw-rounded-lg tw-font-semibold hover:tw-bg-blue-700 tw-transition-colors">
            Start Building! 🛠️
          </Button>
        </div>
      </div>
    </div>
  );
};
