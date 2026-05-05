/**
 * Tests for settings persistence in welcome.web-view.tsx
 *
 * Mirrors the simplified two-tier persistence model used by the real WebView:
 * - `savedX` slots are read from useWebViewState every render (so a key change
 *   from a PT-project switch picks up that project's persisted values).
 * - Local `useState` UI state is seeded from those saved values and mutated by
 *   the user without touching disk.
 * - Persisted writes happen ONLY on a successful export.
 * - WS persistence is keyed per (PT project, FLEx project) pair.
 * - `overwriteEnabled` is intentionally session-scoped (not persisted).
 */

import { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMockUseWebViewState } from '../setup/test-utils';

interface PersistenceTestComponentProps {
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useWebViewState: any;
  initialFlexProject?: string;
  onSaveSettings?: () => void;
}

/**
 * Simulated component mirroring welcome.web-view.tsx's persistence wiring.
 * Each render reads the `saved*` slots fresh; a successful export writes them.
 */
function PersistenceTestComponent({
  projectId,
  useWebViewState,
  initialFlexProject = '',
  onSaveSettings,
}: PersistenceTestComponentProps) {
  // FLEx project — persisted per PT project
  const [savedFlexProjectName, setSavedFlexProjectName] = useWebViewState(
    `flexProjectName-${projectId || 'default'}`,
    ''
  );

  // Local FLEx project selection (drives the WS persistence key)
  const [flexProject, setFlexProject] = useState<string>(savedFlexProjectName || initialFlexProject);
  useEffect(() => {
    if (savedFlexProjectName) setFlexProject(savedFlexProjectName);
  }, [savedFlexProjectName]);

  // WS — keyed per (PT, FLEx) pair. Empty FLEx name means we read the empty-pair slot.
  const wsKey = `writingSystemCode-${projectId || 'default'}-${flexProject || ''}`;
  const [savedWritingSystemCode, setSavedWritingSystemCode] = useWebViewState(wsKey, '');

  const [writingSystem, setWritingSystem] = useState<string>(savedWritingSystemCode || '');
  useEffect(() => {
    setWritingSystem(savedWritingSystemCode || '');
  }, [savedWritingSystemCode]);

  // Filters — persisted per PT project, written only on export success
  const [savedIncludeFootnotes, setSavedIncludeFootnotes] = useWebViewState(
    `includeFootnotes-${projectId || 'default'}`,
    false
  );
  const [savedIncludeCrossRefs, setSavedIncludeCrossRefs] = useWebViewState(
    `includeCrossRefs-${projectId || 'default'}`,
    false
  );
  const [savedIncludeIntro, setSavedIncludeIntro] = useWebViewState(
    `includeIntro-${projectId || 'default'}`,
    false
  );
  const [savedIncludeRemarks, setSavedIncludeRemarks] = useWebViewState(
    `includeRemarks-${projectId || 'default'}`,
    false
  );
  const [savedIncludeFigures, setSavedIncludeFigures] = useWebViewState(
    `includeFigures-${projectId || 'default'}`,
    true
  );

  const [includeFootnotes, setIncludeFootnotes] = useState<boolean>(savedIncludeFootnotes);
  const [includeCrossRefs, setIncludeCrossRefs] = useState<boolean>(savedIncludeCrossRefs);
  const [includeIntro, setIncludeIntro] = useState<boolean>(savedIncludeIntro);
  const [includeRemarks, setIncludeRemarks] = useState<boolean>(savedIncludeRemarks);
  const [includeFigures, setIncludeFigures] = useState<boolean>(savedIncludeFigures);

  useEffect(() => { setIncludeFootnotes(savedIncludeFootnotes); }, [savedIncludeFootnotes]);
  useEffect(() => { setIncludeCrossRefs(savedIncludeCrossRefs); }, [savedIncludeCrossRefs]);
  useEffect(() => { setIncludeIntro(savedIncludeIntro); }, [savedIncludeIntro]);
  useEffect(() => { setIncludeRemarks(savedIncludeRemarks); }, [savedIncludeRemarks]);
  useEffect(() => { setIncludeFigures(savedIncludeFigures); }, [savedIncludeFigures]);

  // Overwrite — session-scoped, NOT persisted
  const [overwriteEnabled, setOverwriteEnabled] = useState<boolean>(false);

  // A successful export writes all persisted slots. Failures must NOT write.
  const handleExportSuccess = () => {
    setSavedFlexProjectName(flexProject);
    setSavedWritingSystemCode(writingSystem);
    setSavedIncludeFootnotes(includeFootnotes);
    setSavedIncludeCrossRefs(includeCrossRefs);
    setSavedIncludeIntro(includeIntro);
    setSavedIncludeRemarks(includeRemarks);
    setSavedIncludeFigures(includeFigures);
    onSaveSettings?.();
  };

  const handleExportFailure = () => {
    // Intentional no-op — failure must not persist anything
  };

  const handleAutoHeal = (validProjects: string[], validWsCodes: string[]) => {
    if (savedFlexProjectName && !validProjects.includes(savedFlexProjectName)) {
      setSavedFlexProjectName('');
    }
    if (savedWritingSystemCode && !validWsCodes.includes(savedWritingSystemCode)) {
      setSavedWritingSystemCode('');
    }
  };

  return (
    <div>
      <div data-testid="project-id">{projectId}</div>
      <div data-testid="saved-flex-project">{savedFlexProjectName}</div>
      <div data-testid="saved-writing-system">{savedWritingSystemCode}</div>
      <div data-testid="ws-key">{wsKey}</div>
      <div data-testid="saved-footnotes">{String(savedIncludeFootnotes)}</div>
      <div data-testid="saved-crossrefs">{String(savedIncludeCrossRefs)}</div>

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

      <input
        type="checkbox"
        data-testid="footnotes-checkbox"
        checked={includeFootnotes}
        onChange={(e) => setIncludeFootnotes(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="crossrefs-checkbox"
        checked={includeCrossRefs}
        onChange={(e) => setIncludeCrossRefs(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="intro-checkbox"
        checked={includeIntro}
        onChange={(e) => setIncludeIntro(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="remarks-checkbox"
        checked={includeRemarks}
        onChange={(e) => setIncludeRemarks(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="figures-checkbox"
        checked={includeFigures}
        onChange={(e) => setIncludeFigures(e.target.checked)}
      />
      <input
        type="checkbox"
        role="switch"
        data-testid="overwrite-toggle"
        checked={overwriteEnabled}
        onChange={(e) => setOverwriteEnabled(e.target.checked)}
      />

      <button data-testid="export-success" onClick={handleExportSuccess}>Export (success)</button>
      <button data-testid="export-failure" onClick={handleExportFailure}>Export (failure)</button>
      <button data-testid="auto-heal-button" onClick={() => handleAutoHeal(['ProjectA', 'ProjectB'], ['en', 'es'])}>
        Auto-Heal
      </button>
    </div>
  );
}

describe('Settings Persistence', () => {
  describe('WebView State Key Format', () => {
    it('FLEx project is keyed per PT project', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(
        <PersistenceTestComponent projectId="test-project-123" useWebViewState={mockUseWebViewState} />
      );
      expect(mockUseWebViewState).toHaveBeenCalledWith('flexProjectName-test-project-123', '');
    });

    it('WS is keyed per (PT project, FLEx project) pair', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(
        <PersistenceTestComponent
          projectId="test-project"
          useWebViewState={mockUseWebViewState}
          initialFlexProject="MyFlex"
        />
      );
      expect(mockUseWebViewState).toHaveBeenCalledWith('writingSystemCode-test-project-MyFlex', '');
    });

    it('WS key updates when FLEx project changes mid-session', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />);

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexA' } });
      await waitFor(() => {
        expect(screen.getByTestId('ws-key')).toHaveTextContent('writingSystemCode-ptp-FlexA');
      });

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexB' } });
      await waitFor(() => {
        expect(screen.getByTestId('ws-key')).toHaveTextContent('writingSystemCode-ptp-FlexB');
      });
    });

    it('uses "default" suffix when projectId is empty', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="" useWebViewState={mockUseWebViewState} />);
      expect(mockUseWebViewState).toHaveBeenCalledWith('flexProjectName-default', '');
    });

    it('overwriteEnabled is NOT persisted (session-scoped)', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="any" useWebViewState={mockUseWebViewState} />);
      // No useWebViewState call should have occurred for overwriteEnabled
      const calls = mockUseWebViewState.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain('overwriteEnabled');
    });
  });

  describe('Save only on export success', () => {
    it('toggling a filter without exporting does NOT write to disk', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(
        <PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />
      );

      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      expect(screen.getByTestId('footnotes-checkbox')).toBeChecked();
      // Saved value remains the default (false) — local toggle did not persist
      expect(screen.getByTestId('saved-footnotes')).toHaveTextContent('false');
    });

    it('a successful export writes all persisted slots', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const onSaveSettings = jest.fn();
      render(
        <PersistenceTestComponent
          projectId="ptp"
          useWebViewState={mockUseWebViewState}
          onSaveSettings={onSaveSettings}
        />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'MyFlex' } });
      fireEvent.change(screen.getByTestId('writing-system-input'), { target: { value: 'en' } });
      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      fireEvent.click(screen.getByTestId('export-success'));

      expect(onSaveSettings).toHaveBeenCalled();
      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('MyFlex');
      expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('en');
      expect(screen.getByTestId('saved-footnotes')).toHaveTextContent('true');
    });

    it('an export failure writes NOTHING', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(
        <PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'WillNotPersist' } });
      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      fireEvent.click(screen.getByTestId('export-failure'));

      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
      expect(screen.getByTestId('saved-footnotes')).toHaveTextContent('false');
    });
  });

  describe('Settings Restoration', () => {
    it('seeds local FLEx project from saved value', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'ptp';

      const { rerender } = render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'MyFlex' } });
      fireEvent.click(screen.getByTestId('export-success'));

      rerender(<PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />);

      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('MyFlex');
      });
    });

    it('seeds local checkbox states from saved values', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      const projectId = 'ptp';

      const { rerender } = render(
        <PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />
      );

      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      fireEvent.click(screen.getByTestId('crossrefs-checkbox'));
      fireEvent.click(screen.getByTestId('export-success'));

      rerender(<PersistenceTestComponent projectId={projectId} useWebViewState={mockUseWebViewState} />);

      await waitFor(() => {
        expect(screen.getByTestId('footnotes-checkbox')).toBeChecked();
        expect(screen.getByTestId('crossrefs-checkbox')).toBeChecked();
      });
    });
  });

  describe('Per-Project Scoping', () => {
    it('different PT projects have separate filter slots', async () => {
      const mockUseWebViewState = createMockUseWebViewState();

      const { rerender } = render(
        <PersistenceTestComponent projectId="project-A" useWebViewState={mockUseWebViewState} />
      );

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexForA' } });
      fireEvent.click(screen.getByTestId('export-success'));

      rerender(
        <PersistenceTestComponent projectId="project-B" useWebViewState={mockUseWebViewState} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
      });

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexForB' } });
      fireEvent.click(screen.getByTestId('export-success'));

      rerender(
        <PersistenceTestComponent projectId="project-A" useWebViewState={mockUseWebViewState} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('FlexForA');
      });
    });

    it('each (PT, FLEx) pair persists its own WS independently', async () => {
      const mockUseWebViewState = createMockUseWebViewState();

      render(<PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />);

      // (ptp, FlexA) → en
      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexA' } });
      fireEvent.change(screen.getByTestId('writing-system-input'), { target: { value: 'en' } });
      fireEvent.click(screen.getByTestId('export-success'));

      // (ptp, FlexB) → es
      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexB' } });
      // Saved WS for (ptp, FlexB) is empty initially
      await waitFor(() => {
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('');
      });
      fireEvent.change(screen.getByTestId('writing-system-input'), { target: { value: 'es' } });
      fireEvent.click(screen.getByTestId('export-success'));
      await waitFor(() => {
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('es');
      });

      // Switch back to FlexA — should restore en, not es
      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'FlexA' } });
      await waitFor(() => {
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('en');
      });
    });
  });

  describe('Defaults', () => {
    it('FLEx project defaults to empty string', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="new" useWebViewState={mockUseWebViewState} />);
      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
    });

    it('most filters default to false; figures defaults to true', () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="new" useWebViewState={mockUseWebViewState} />);
      expect(screen.getByTestId('footnotes-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('crossrefs-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('intro-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('remarks-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('figures-checkbox')).toBeChecked();
      expect(screen.getByTestId('overwrite-toggle')).not.toBeChecked();
    });
  });

  describe('Auto-Heal', () => {
    it('clears saved FLEx project when its target no longer exists', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />);

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'DeletedProject' } });
      fireEvent.click(screen.getByTestId('export-success'));
      expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('DeletedProject');

      fireEvent.click(screen.getByTestId('auto-heal-button'));
      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('');
      });
    });

    it('clears saved WS when its code is no longer in the FLEx project', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />);

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'ProjectA' } });
      fireEvent.change(screen.getByTestId('writing-system-input'), { target: { value: 'xyz' } });
      fireEvent.click(screen.getByTestId('export-success'));

      fireEvent.click(screen.getByTestId('auto-heal-button'));
      await waitFor(() => {
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('');
      });
    });

    it('keeps valid settings intact when healing invalid ones', async () => {
      const mockUseWebViewState = createMockUseWebViewState();
      render(<PersistenceTestComponent projectId="ptp" useWebViewState={mockUseWebViewState} />);

      fireEvent.change(screen.getByTestId('flex-project-input'), { target: { value: 'ProjectA' } });
      fireEvent.change(screen.getByTestId('writing-system-input'), { target: { value: 'xyz' } });
      fireEvent.click(screen.getByTestId('footnotes-checkbox'));
      fireEvent.click(screen.getByTestId('export-success'));

      fireEvent.click(screen.getByTestId('auto-heal-button'));

      await waitFor(() => {
        expect(screen.getByTestId('saved-flex-project')).toHaveTextContent('ProjectA');
        expect(screen.getByTestId('saved-writing-system')).toHaveTextContent('');
        expect(screen.getByTestId('footnotes-checkbox')).toBeChecked();
      });
    });
  });
});
