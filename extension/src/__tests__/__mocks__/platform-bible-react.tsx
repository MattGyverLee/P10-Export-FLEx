/**
 * Mock for platform-bible-react module
 */

import React, { forwardRef } from 'react';

// Mock Button component
export const Button = forwardRef<
  HTMLButtonElement,
  {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
  }
>(({ children, onClick, disabled, variant, size, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    onClick={onClick}
    disabled={disabled}
    data-variant={variant}
    data-size={size}
    className={className}
    {...props}
  >
    {children}
  </button>
));
Button.displayName = 'Button';

// Mock Checkbox component
export const Checkbox = ({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  ...props
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    disabled={disabled}
    className={className}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
);

// Mock Switch component
export const Switch = ({
  checked,
  onCheckedChange,
  id,
  disabled,
  className,
  ...props
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <input
    type="checkbox"
    role="switch"
    id={id}
    checked={checked}
    disabled={disabled}
    className={className}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
);

// Mock Input component
export const Input = forwardRef<
  HTMLInputElement,
  {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    id?: string;
    disabled?: boolean;
    className?: string;
    type?: string;
  }
>(({ value, onChange, placeholder, id, disabled, className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    id={id}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className={className}
    {...props}
  />
));
Input.displayName = 'Input';

// Mock Label component
export const Label = ({
  children,
  htmlFor,
  className,
  ...props
}: {
  children?: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) => (
  <label htmlFor={htmlFor} className={className} {...props}>
    {children}
  </label>
);

// Mock ComboBox component
interface ComboBoxOption {
  label?: string;
  value?: unknown;
}

export const ComboBox = <T extends ComboBoxOption>({
  options = [],
  value,
  onChange,
  getOptionLabel,
  buttonPlaceholder,
  id,
  disabled,
  className,
  ...props
}: {
  options?: T[];
  value?: T;
  onChange?: (option: T) => void;
  getOptionLabel?: (option: T) => string;
  buttonPlaceholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  textPlaceholder?: string;
  commandEmptyMessage?: string;
}) => {
  const getLabelFn = getOptionLabel || ((opt: T) => opt.label || String(opt));

  return (
    <select
      id={id}
      disabled={disabled}
      className={className}
      value={value ? getLabelFn(value) : ''}
      onChange={(e) => {
        const selected = options.find((opt) => getLabelFn(opt) === e.target.value);
        if (selected && onChange) {
          onChange(selected);
        }
      }}
      data-testid={`combobox-${id}`}
      {...props}
    >
      <option value="">{buttonPlaceholder || 'Select...'}</option>
      {options.map((opt, idx) => (
        <option key={idx} value={getLabelFn(opt)}>
          {getLabelFn(opt)}
        </option>
      ))}
    </select>
  );
};

// Mock BookChapterControl component
interface ScriptureReference {
  book: string;
  chapterNum: number;
  verseNum: number;
}

export const BookChapterControl = ({
  scrRef,
  handleSubmit,
  getActiveBookIds,
}: {
  scrRef: ScriptureReference;
  handleSubmit: (newRef: ScriptureReference) => void;
  getActiveBookIds?: () => string[];
}) => {
  const activeBooks = getActiveBookIds?.() || ['GEN', 'EXO', 'MAT'];

  return (
    <div data-testid="book-chapter-control">
      <select
        data-testid="book-selector"
        value={scrRef.book}
        onChange={(e) => handleSubmit({ ...scrRef, book: e.target.value, chapterNum: 1 })}
      >
        {activeBooks.map((bookId) => (
          <option key={bookId} value={bookId}>
            {bookId}
          </option>
        ))}
      </select>
      <input
        type="number"
        data-testid="chapter-input"
        value={scrRef.chapterNum}
        min={1}
        onChange={(e) =>
          handleSubmit({ ...scrRef, chapterNum: parseInt(e.target.value, 10) || 1 })
        }
      />
    </div>
  );
};

// Mock Slider component (if needed)
export const Slider = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  id,
  disabled,
  className,
}: {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <input
    type="range"
    id={id}
    value={value?.[0] ?? min}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    className={className}
    onChange={(e) => onValueChange?.([parseInt(e.target.value, 10)])}
    data-testid={`slider-${id}`}
  />
);
