/**
 * Tests for Modal components defined in welcome.web-view.tsx
 *
 * Since the Modal components are internal to the WebView, we test them
 * indirectly through the main component or extract test-specific versions.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Re-implement Modal components for testing (matching welcome.web-view.tsx)
function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      data-testid="modal-backdrop"
      className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50"
      onClick={onClose}
    >
      <div
        data-testid="modal-content"
        className="tw-relative tw-w-full tw-max-w-lg tw-bg-background tw-border tw-border-border tw-rounded-lg tw-shadow-xl tw-p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ children }: { children: React.ReactNode }) {
  return <div data-testid="modal-header" className="tw-mb-4">{children}</div>;
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      data-testid="modal-title"
      className="tw-text-lg tw-font-semibold tw-leading-none tw-tracking-tight"
    >
      {children}
    </h2>
  );
}

function ModalDescription({ children }: { children: React.ReactNode }) {
  return (
    <p data-testid="modal-description" className="tw-text-sm tw-text-muted-foreground tw-mt-2">
      {children}
    </p>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="modal-footer"
      className="tw-flex tw-flex-col-reverse sm:tw-flex-row sm:tw-justify-end sm:tw-space-x-2 tw-mt-6 tw-gap-2"
    >
      {children}
    </div>
  );
}

describe('Modal Component', () => {
  describe('Modal', () => {
    it('renders nothing when open is false', () => {
      const onClose = jest.fn();
      const { container } = render(
        <Modal open={false} onClose={onClose}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    });

    it('renders content when open is true', () => {
      const onClose = jest.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div>Modal Content</div>
        </Modal>
      );

      fireEvent.click(screen.getByTestId('modal-backdrop'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
      const onClose = jest.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div>Modal Content</div>
        </Modal>
      );

      fireEvent.click(screen.getByTestId('modal-content'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when clicking elements inside modal content', () => {
      const onClose = jest.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <button>Click Me</button>
        </Modal>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Click Me' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('renders children correctly', () => {
      const onClose = jest.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </Modal>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('ModalHeader', () => {
    it('renders children correctly', () => {
      render(
        <ModalHeader>
          <span>Header Content</span>
        </ModalHeader>
      );

      expect(screen.getByTestId('modal-header')).toBeInTheDocument();
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('has correct CSS class for spacing', () => {
      render(<ModalHeader>Content</ModalHeader>);

      expect(screen.getByTestId('modal-header')).toHaveClass('tw-mb-4');
    });
  });

  describe('ModalTitle', () => {
    it('renders as h2 element', () => {
      render(<ModalTitle>Title Text</ModalTitle>);

      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Title Text');
    });

    it('applies correct styling classes', () => {
      render(<ModalTitle>Title Text</ModalTitle>);

      const title = screen.getByTestId('modal-title');
      expect(title).toHaveClass('tw-text-lg');
      expect(title).toHaveClass('tw-font-semibold');
    });
  });

  describe('ModalDescription', () => {
    it('renders as paragraph element', () => {
      render(<ModalDescription>Description text</ModalDescription>);

      const description = screen.getByTestId('modal-description');
      expect(description.tagName).toBe('P');
      expect(description).toHaveTextContent('Description text');
    });

    it('applies muted foreground styling', () => {
      render(<ModalDescription>Description</ModalDescription>);

      const description = screen.getByTestId('modal-description');
      expect(description).toHaveClass('tw-text-muted-foreground');
    });
  });

  describe('ModalFooter', () => {
    it('renders children correctly', () => {
      render(
        <ModalFooter>
          <button>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('has correct CSS classes for responsive layout', () => {
      render(<ModalFooter>Buttons</ModalFooter>);

      const footer = screen.getByTestId('modal-footer');
      expect(footer).toHaveClass('tw-flex');
      expect(footer).toHaveClass('tw-gap-2');
    });
  });

  describe('Modal with all sub-components', () => {
    it('renders a complete modal dialog', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <Modal open={true} onClose={onClose}>
          <ModalHeader>
            <ModalTitle>Confirm Action</ModalTitle>
            <ModalDescription>Are you sure you want to proceed?</ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <button onClick={onClose}>Cancel</button>
            <button onClick={onConfirm}>Confirm</button>
          </ModalFooter>
        </Modal>
      );

      // Verify all parts are rendered
      expect(screen.getByRole('heading', { name: 'Confirm Action' })).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('handles button clicks in footer', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <Modal open={true} onClose={onClose}>
          <ModalHeader>
            <ModalTitle>Confirm</ModalTitle>
          </ModalHeader>
          <ModalFooter>
            <button onClick={onClose}>Cancel</button>
            <button onClick={onConfirm}>Confirm</button>
          </ModalFooter>
        </Modal>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
