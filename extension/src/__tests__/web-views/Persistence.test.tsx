/**
 * Tests for settings persistence in welcome.web-view.tsx
 *
 * Tests the WebView state persistence mechanism using flat keys
 * and per-project scoping.
 */

import { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMockUseWebViewState } from '../setup/test-utils';

// Simulated component that mimics the persistence behavior of welcome.web-view.tsx
interface PersistenceTestComponentProps {
  projectId: string;
  // Use any type for the mock function to avoid complex generic type issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useWebViewState: any;
  onSaveSettings?: () => void;
}

function PersistenceTestComponent({
  projectId,
  useWebViewState,
  onSaveSettings,
}: PersistenceTestComponentProps) {
  // Per-project settings using flat keys (matching welcome.web-view.tsx pattern)
  const [savedFlexProjectName, setSavedFlexProjectName] = useWebViewState(
    `flexProjectName-${projectId || 'default'}`,
    ''
  );
  const [savedWritingSystemCode, setSavedWritingSystemCode] = useWebViewState(
    `writingSystemCode-${projectId || 'default'}`,
    ''
  );
  const [includeFootnotes, setIncludeFootnotes] = useWebViewState(
    `includeFootnotes-${projectId || 'default'}`,
    false
  );
  const [includeCrossRefs, setIncludeCrossRefs] = useWebViewState(
    `includeCrossRefs-${projectId || 'default'}`,
    false
  );
  const [includeIntro, setIncludeIntro] = useWebViewState(
    `includeIntro-${projectId || 'default'}`,
    false
  );
  const [includeRemarks, setIncludeRemarks] = useWebViewState(
    `includeRemarks-${projectId || 'default'}`,
    false
  );
  const [includeFigures, setIncludeFigures] = useWebViewState(
    `includeFigures-${projectId || 'default'}`,
    true
  );
  // Global setting (no projectId suffix)
  const [overwriteEnabled, setOverwriteEnabled] = useWebViewState(
    'overwriteEnabled',
    false
  );

  // Local state for form inputs
  const [flexProject, setFlexProject] = useState(savedFlexProjectName);
  const [writingSystem, setWritingSystem] = useState(savedWritingSystemCode);

  // Update local state when saved values change (restoration)
  useEffect(() => {
    if (savedFlexProjectName) {
      setFlexProject(savedFlexProjectName);
    }
  }, [savedFlexProjectName]);

  useEffect(() => {
    if (savedWritingSystemCode) {
      setWritingSystem(savedWritingSystemCode);
    }
  }, [savedWritingSystemCode]);

  // Simulate successful export that saves settings
  const handleExportSuccess = () => {
    setSavedFlexProjectName(flexProject);
    setSavedWritingSystemCode(writingSystem);
    // Checkboxes are already using WebView state directly
    onSaveSettings?.();
  };

  return (
    <div>
      <div data-testid="project-id">{projectId}</div>
      <div data-testid="saved-flex-project">{savedFlexProjectName}</div>
      <div data-testid="saved-writing-system">{savedWritingSystemCode}</div>

      <input
        data-testid="flex-project-input"
        value={flexProject}
        onChange={(e) => setFlexProject(e.target.value)}
      />

      <input
        data-testid="writing-system-input"
        value={writingSystem}
        onChange={(e) => setWritingSystem(e.target.value)}
      />

      <label>
        <input
          type="checkbox"
          data-testid="footnotes-checkbox"
          checked={includeFootnotes}
          onChange={(e) => setIncludeFootnotes(e.target.checked)}
        />
        Include Footnotes
      </label>

      <label>
        <input
          type="checkbox"
          data-testid="crossrefs-checkbox"
          checked={includeCrossRefs}
          onChange={(e) => setIncludeCrossRefs(e.target.checked)}
        />
        Include Cross-Refs
      </label>

      <label>
        <input
          type="checkbox"
          data-testid="intro-checkbox"
          checked={includeIntro}
          onChange={(e) => setIncludeIntro(e.target.checked)}
        />
        Include Introduction
      </label>

      <label>
        <input
          type="checkbox"
          data-testid="remarks-checkbox"
          checked={includeRemarks}
          onChange={(e) => setIncludeRemarks(e.target.checked)}
        />
        Include Remarks
      </label>

      <label>
        <input
          type="checkbox"
          data-testid="figures-checkbox"
          checked={includeFigures}
          onChange={(e) => setIncludeFigures(e.target.checked)}
        />
        Include Figures
      </label>

      <label>
        <input
          type="checkbox"
          role="switch"
          data-testid="overwrite-toggle"
          checked={overwriteEnabled}
          onChange={(e) => setOverwriteEnabled(e.target.checked)}
        />
        Overwrite Enabled
      </label>

      <button data-testid="export-button" onClick={handleExportSuccess}>
        Export (Success)
      </button>
    </div>
  );
}

describe('Settings Persistence', () => {
  describe('WebView State Key Format', () => {
    it('uses flat key format with projectId suffix', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'test-project-123';

      render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      // Verify the hook was called with correct key format
      expect(mockUseWebViewState).toHaveBeenCalledWith(
        `flexProjectName-${projectId}`,
        ''
      );
      expect(mockUseWebViewState).toHaveBeenCalledWith(
        `writingSystemCode-${projectId}`,
        ''
      );
      expect(mockUseWebViewState).toHaveBeenCalledWith(
        `includeFootnotes-${projectId}`,
        false
      );
    });

    it('uses "default" suffix when projectId is empty', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(<PersistenceTestComponent projectId="" useWebViewState={mockUseWebViewState} />);

      expect(mockUseWebViewState).toHaveBeenCalledWith('flexProjectName-default', '');
      expect(mockUseWebViewState).toHaveBeenCalledWith('writingSystemCode-default', '');
    });

    it('overwrite toggle is global (no projectId suffix)', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="any-project" useWebViewState={mockUseWebViewState} />
      );

      expect(mockUseWebViewState).toHaveBeenCalledWith('overwriteEnabled', false);
    });
  });

  describe('Settings Restoration', () => {
    it('restores FLEx project from WebView state', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'test-project';

      // First render to initialize state
      const { rerender } = render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      // Simulate entering and saving a FLEx project
      fireEvent.change(screen.getByTestId('flex-project-input'), {
        target: { value: 'MyFlexProject' },
      });
      fireEvent.click(screen.getByTestId('export-button'));

      // Rerender to simulate reopening the dialog
      rerender(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('MyFlexProject');
      });
    });

    it('restores writing system from WebView state', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'test-project';

      const { rerender } = render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      fireEvent.change(screen.getByTestId('writing-system-input'), {
        target: { value: 'es' },
      });
      fireEvent.click(screen.getByTestId('export-button'));

      rerender(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('es');
      });
    });

    it('restores checkbox states from WebView state', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'test-project';

      const { rerender } = render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      // Toggle checkboxes
      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      fireEvent.click(screen.getByTestId('crossrefs-checkbox'));

      // Rerender
      rerender(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('footnotes-checkbox')).toBeChecked();
        expect(screen.getByTestId('crossrefs-checkbox')).toBeChecked();
      });
    });
  });

  describe('Settings Save After Export', () => {
    it('saves FLEx project and writing system on successful export', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const onSaveSettings = jest.fn();

      render(
        <PersistenceTestComponent
          projectId="test-project"
          useWebViewState={mockUseWebViewState}
          onSaveSettings={onSaveSettings}
        />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), {
        target: { value: 'SavedProject' },
      });
      fireEvent.change(screen.getByTestId('writing-system-input'), {
        target: { value: 'en' },
      });

      fireEvent.click(screen.getByTestId('export-button'));

      expect(onSaveSettings).toHaveBeenCalled();
      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('SavedProject');
      expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('en');
    });

    it('checkbox states are saved via WebView state directly', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="test-project" useWebViewState={mockUseWebViewState} />
      );

      // Checkboxes use WebView state directly, so they're saved on change
      fireEvent.click(screen.getByTestId('footnotes-checkbox'));

      // The state should be updated immediately
      expect(screen.getByTestId('footnotes-checkbox')).toBeChecked();
    });
  });

  describe('Per-Project Scoping', () => {
    it('different projects have separate settings', async () => {
      const mockUseWebViewState = createMockUseWebViewState();

      // Set settings for project A
      const { rerender } = render(
        <PersistenceTestComponent projectId="project-A" useWebViewState={mockUseWebViewState} />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), {
        target: { value: 'FlexForProjectA' },
      });
      fireEvent.click(screen.getByTestId('export-button'));

      // Switch to project B
      rerender(
        <PersistenceTestComponent projectId="project-B" useWebViewState={mockUseWebViewState} />
      );

      // Project B should have empty/default values
      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
      });

      // Set settings for project B
      fireEvent.change(screen.getByTestId('flex-project-input'), {
        target: { value: 'FlexForProjectB' },
      });
      fireEvent.click(screen.getByTestId('export-button'));

      // Switch back to project A
      rerender(
        <PersistenceTestComponent projectId="project-A" useWebViewState={mockUseWebViewState} />
      );

      // Project A should still have its original settings
      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('FlexForProjectA');
      });
    });

    it('overwrite toggle is shared across projects', async () => {
      const mockUseWebViewState = createMockUseWebViewState();

      // Enable overwrite for project A
      const { rerender } = render(
        <PersistenceTestComponent projectId="project-A" useWebViewState={mockUseWebViewState} />
      );

      fireEvent.click(screen.getByTestId('overwrite-toggle'));
      expect(screen.getByTestId('overwrite-toggle')).toBeChecked();

      // Switch to project B
      rerender(
        <PersistenceTestComponent projectId="project-B" useWebViewState={mockUseWebViewState} />
      );

      // Overwrite should still be enabled (global setting)
      await waitFor(() => {
        expect(screen.getByTestId('overwrite-toggle')).toBeChecked();
      });
    });
  });

  describe('Default Values', () => {
    it('uses empty string for FLEx project by default', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="new-project" useWebViewState={mockUseWebViewState} />
      );

      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
    });

    it('uses empty string for writing system by default', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="new-project" useWebViewState={mockUseWebViewState} />
      );

      expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('');
    });

    it('uses false for most checkboxes by default', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="new-project" useWebViewState={mockUseWebViewState} />
      );

      expect(screen.getByTestId('footnotes-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('crossrefs-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('intro-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('remarks-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('overwrite-toggle')).not.toBeChecked();
    });

    it('uses true for includeFigures by default', () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(
        <PersistenceTestComponent projectId="new-project" useWebViewState={mockUseWebViewState} />
      );

      expect(screen.getByTestId('figures-checkbox')).toBeChecked();
    });
  });
});
