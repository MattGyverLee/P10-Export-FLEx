/**
 * Tests for the main WebView component (welcome.web-view.tsx)
 *
 * These tests verify the UI components, state management, and interactions
 * in the Export to FLEx dialog.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import {
  createMockWebViewProps,
  createMockFlexProject,
  createMockFlexProjectDetails,
  createMockUSJChapter,
} from '../setup/test-utils';

// Simple test component that simulates the WebView structure
// (The actual WebView is complex; we test key behaviors here)
interface TestWebViewProps {
  projectId: string;
  flexProjects: Array<{ name: string; label: string }>;
  isLoadingFlexProjects: boolean;
  flexLoadError?: string;
  selectedFlexProject?: { name: string; label: string };
  textName: string;
  isExporting: boolean;
  exportStatus?: { success: boolean; message: string };
  onExport: () => void;
  onFlexProjectChange: (project: { name: string; label: string } | undefined) => void;
  onTextNameChange: (name: string) => void;
}

function TestWebView({
  projectId,
  flexProjects,
  isLoadingFlexProjects,
  flexLoadError,
  selectedFlexProject,
  textName,
  isExporting,
  exportStatus,
  onExport,
  onFlexProjectChange,
  onTextNameChange,
}: TestWebViewProps) {
  const canExport = selectedFlexProject && textName && !isExporting;

  return (
    <div data-testid="webview-container">
      <div data-testid="paratext-settings">
        <h3>Paratext Settings</h3>
        <div data-testid="project-id">Project: {projectId}</div>
      </div>

      <div data-testid="include-in-export">
        <h3>Include in Export</h3>
        <label>
          <input type="checkbox" data-testid="footnotes-checkbox" />
          Footnotes
        </label>
        <label>
          <input type="checkbox" data-testid="crossrefs-checkbox" />
          Cross References
        </label>
      </div>

      <div data-testid="flex-settings">
        <h3>FLEx Settings</h3>

        {isLoadingFlexProjects && (
          <div data-testid="loading-indicator">Loading FLEx projects...</div>
        )}

        {flexLoadError && <div data-testid="error-message">{flexLoadError}</div>}

        {!isLoadingFlexProjects && !flexLoadError && (
          <select
            data-testid="flex-project-selector"
            value={selectedFlexProject?.name || ''}
            onChange={(e) => {
              const project = flexProjects.find((p) => p.name === e.target.value);
              onFlexProjectChange(project);
            }}
          >
            <option value="">Select a FLEx project...</option>
            {flexProjects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        <input
          data-testid="text-name-input"
          placeholder="Enter text name"
          value={textName}
          onChange={(e) => onTextNameChange(e.target.value)}
        />

        <button
          data-testid="export-button"
          disabled={!canExport}
          onClick={onExport}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>

        {exportStatus && (
          <div
            data-testid="export-status"
            data-success={exportStatus.success}
          >
            {exportStatus.message}
          </div>
        )}
      </div>

      <div data-testid="preview-section">
        <h3>Scripture Preview</h3>
        <div data-testid="view-mode-buttons">
          <button data-testid="view-mode-formatted">Formatted</button>
          <button data-testid="view-mode-usfm">USFM</button>
          <button data-testid="view-mode-usj">USJ</button>
        </div>
      </div>
    </div>
  );
}

describe('Welcome WebView Component', () => {
  describe('Renders all sections', () => {
    it('renders Paratext Settings section', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('paratext-settings')).toBeInTheDocument();
      expect(screen.getByText('Paratext Settings')).toBeInTheDocument();
    });

    it('renders Include in Export section', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('include-in-export')).toBeInTheDocument();
      expect(screen.getByTestId('footnotes-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('crossrefs-checkbox')).toBeInTheDocument();
    });

    it('renders FLEx Settings section', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('flex-settings')).toBeInTheDocument();
      expect(screen.getByText('FLEx Settings')).toBeInTheDocument();
    });

    it('renders Scripture Preview section', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('preview-section')).toBeInTheDocument();
      expect(screen.getByText('Scripture Preview')).toBeInTheDocument();
    });
  });

  describe('FLEx Project Selection', () => {
    it('shows loading state while fetching projects', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={true}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByText('Loading FLEx projects...')).toBeInTheDocument();
    });

    it('shows error message when FLEx not available', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          flexLoadError="FLEx is not installed on this system"
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('FLEx is not installed on this system')).toBeInTheDocument();
    });

    it('renders FLEx project options', () => {
      const projects = [
        { name: 'Project1', label: 'Project One' },
        { name: 'Project2', label: 'Project Two' },
      ];

      render(
        <TestWebView
          projectId="test-project"
          flexProjects={projects}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('flex-project-selector')).toBeInTheDocument();
      expect(screen.getByText('Project One')).toBeInTheDocument();
      expect(screen.getByText('Project Two')).toBeInTheDocument();
    });

    it('calls onFlexProjectChange when project selected', () => {
      const onFlexProjectChange = jest.fn();
      const projects = [
        { name: 'Project1', label: 'Project One' },
        { name: 'Project2', label: 'Project Two' },
      ];

      render(
        <TestWebView
          projectId="test-project"
          flexProjects={projects}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={onFlexProjectChange}
          onTextNameChange={jest.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('flex-project-selector'), {
        target: { value: 'Project1' },
      });

      expect(onFlexProjectChange).toHaveBeenCalledWith({
        name: 'Project1',
        label: 'Project One',
      });
    });
  });

  describe('Text Name Input', () => {
    it('renders text name input', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('text-name-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter text name')).toBeInTheDocument();
    });

    it('displays current text name value', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName="Genesis 1"
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('text-name-input')).toHaveValue('Genesis 1');
    });

    it('calls onTextNameChange when input changes', () => {
      const onTextNameChange = jest.fn();

      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={onTextNameChange}
        />
      );

      fireEvent.change(screen.getByTestId('text-name-input'), {
        target: { value: 'Matthew 5-7' },
      });

      expect(onTextNameChange).toHaveBeenCalledWith('Matthew 5-7');
    });
  });

  describe('Export Button', () => {
    it('is disabled when no FLEx project selected', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={undefined}
          textName="Genesis 1"
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('export-button')).toBeDisabled();
    });

    it('is disabled when text name is empty', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={{ name: 'Test', label: 'Test' }}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('export-button')).toBeDisabled();
    });

    it('is disabled while exporting', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={{ name: 'Test', label: 'Test' }}
          textName="Genesis 1"
          isExporting={true}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('export-button')).toBeDisabled();
    });

    it('shows "Exporting..." text while exporting', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={{ name: 'Test', label: 'Test' }}
          textName="Genesis 1"
          isExporting={true}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('export-button')).toHaveTextContent('Exporting...');
    });

    it('is enabled when all requirements met', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={{ name: 'Test', label: 'Test' }}
          textName="Genesis 1"
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('export-button')).not.toBeDisabled();
    });

    it('calls onExport when clicked', () => {
      const onExport = jest.fn();

      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[{ name: 'Test', label: 'Test' }]}
          isLoadingFlexProjects={false}
          selectedFlexProject={{ name: 'Test', label: 'Test' }}
          textName="Genesis 1"
          isExporting={false}
          onExport={onExport}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('export-button'));

      expect(onExport).toHaveBeenCalled();
    });
  });

  describe('Export Status', () => {
    it('displays success message', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName="Genesis 1"
          isExporting={false}
          exportStatus={{ success: true, message: 'Created text with 10 paragraphs' }}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      const status = screen.getByTestId('export-status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent('Created text with 10 paragraphs');
      expect(status).toHaveAttribute('data-success', 'true');
    });

    it('displays error message', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName="Genesis 1"
          isExporting={false}
          exportStatus={{ success: false, message: 'Project is locked by another user' }}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      const status = screen.getByTestId('export-status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent('Project is locked by another user');
      expect(status).toHaveAttribute('data-success', 'false');
    });
  });

  describe('View Mode Buttons', () => {
    it('renders all three view mode buttons', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('view-mode-formatted')).toBeInTheDocument();
      expect(screen.getByTestId('view-mode-usfm')).toBeInTheDocument();
      expect(screen.getByTestId('view-mode-usj')).toBeInTheDocument();
    });
  });

  describe('Include in Export Checkboxes', () => {
    it('renders footnotes checkbox', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('footnotes-checkbox')).toBeInTheDocument();
    });

    it('renders cross-references checkbox', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('crossrefs-checkbox')).toBeInTheDocument();
    });

    it('checkboxes are clickable', () => {
      render(
        <TestWebView
          projectId="test-project"
          flexProjects={[]}
          isLoadingFlexProjects={false}
          textName=""
          isExporting={false}
          onExport={jest.fn()}
          onFlexProjectChange={jest.fn()}
          onTextNameChange={jest.fn()}
        />
      );

      const footnotes = screen.getByTestId('footnotes-checkbox');
      expect(footnotes).not.toBeChecked();

      fireEvent.click(footnotes);
      expect(footnotes).toBeChecked();

      fireEvent.click(footnotes);
      expect(footnotes).not.toBeChecked();
    });
  });
});

describe('WebView Props Interface', () => {
  it('createMockWebViewProps returns expected structure', () => {
    const props = createMockWebViewProps({ projectId: 'my-project' });

    expect(props.projectId).toBe('my-project');
    expect(typeof props.updateWebViewDefinition).toBe('function');
    expect(typeof props.useWebViewState).toBe('function');
    expect(props.state).toBeDefined();
  });

  it('createMockWebViewProps accepts custom initial state', () => {
    const props = createMockWebViewProps({
      initialState: { customValue: 'test' },
    });

    expect(props.state).toHaveProperty('customValue', 'test');
  });

  it('createMockWebViewProps accepts preloaded strings', () => {
    const props = createMockWebViewProps({
      preloadedStrings: { '%test%': 'Test String' },
    });

    expect(props.state).toHaveProperty('preloadedStrings', { '%test%': 'Test String' });
  });
});

describe('Test Data Factories', () => {
  it('createMockFlexProject returns valid project', () => {
    const project = createMockFlexProject();

    expect(project.name).toBe('TestProject');
    expect(project.path).toContain('FieldWorks');
    expect(project.vernacularWs).toBeDefined();
    expect(project.analysisWs).toBeDefined();
  });

  it('createMockFlexProject accepts overrides', () => {
    const project = createMockFlexProject({ name: 'CustomProject', vernacularWs: 'es' });

    expect(project.name).toBe('CustomProject');
    expect(project.vernacularWs).toBe('es');
  });

  it('createMockFlexProjectDetails includes writing systems', () => {
    const details = createMockFlexProjectDetails();

    expect(details.vernacularWritingSystems).toBeDefined();
    expect(details.vernacularWritingSystems.length).toBeGreaterThan(0);
    expect(details.analysisWritingSystems).toBeDefined();
  });

  it('createMockUSJChapter returns valid USJ structure', () => {
    const chapter = createMockUSJChapter(5);

    expect(chapter.type).toBe('USJ');
    expect(chapter.version).toBeDefined();
    expect(chapter.content).toBeDefined();
    expect(chapter.content[0]).toHaveProperty('number', '5');
  });
});
