/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from '@/ui';
import { useI18n } from '@/i18n/react';
import type { Locale } from '@/i18n/core';

/**
 * Typing a price is the riskiest thing a person does in Pinto: a field that
 * re-parsed on every keystroke once turned 4.99 into 499. These tests type
 * character by character, the way people do.
 */

function setLocale(locale: Locale) {
  act(() => useI18n.getState().setPreference(locale, locale));
}

function Harness({
  initial = null,
  onCommit,
  min,
}: {
  initial?: number | null;
  onCommit: (value: number | null) => void;
  min?: number;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <NumberField
        label="Price"
        value={value}
        min={min}
        invalidMessage="Not a number"
        onCommit={(next) => {
          onCommit(next);
          setValue(next);
        }}
      />
      <button type="button" onClick={() => setValue(9.99)}>
        preset
      </button>
    </>
  );
}

afterEach(() => setLocale('en'));

describe('NumberField', () => {
  it('keeps the decimal point while typing 4.99', async () => {
    setLocale('en');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, '4.99');

    expect(input.value).toBe('4.99');
    expect(onCommit).toHaveBeenLastCalledWith(4.99);
    // "4." committed 4 on the way, never 49 or 499.
    expect(onCommit.mock.calls.map(([v]) => v)).toEqual([4, 4, 4.9, 4.99]);
  });

  it('accepts a decimal comma in French', async () => {
    setLocale('fr');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, '4,99');
    expect(onCommit).toHaveBeenLastCalledWith(4.99);
    expect(input.value).toBe('4,99');
  });

  it('accepts a negative value with a comma in French', async () => {
    setLocale('fr');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, '-12,5');
    expect(onCommit).toHaveBeenLastCalledWith(-12.5);
    expect(input.value).toBe('-12,5');
  });

  it('accepts a dot in French too, and shows it back with a comma on blur', async () => {
    setLocale('fr');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, '4.5');
    await userEvent.tab();
    expect(onCommit).toHaveBeenLastCalledWith(4.5);
    expect(input.value).toBe('4,5');
  });

  it('commits nothing for text that is not a number, and flags it once the field is left', async () => {
    setLocale('en');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, 'abc');
    expect(onCommit).not.toHaveBeenCalled();
    // Not while typing: half-typed text is not an error yet.
    expect(input.hasAttribute('aria-invalid')).toBe(false);

    await userEvent.tab();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Not a number');
    // The error is linked to the field for screen readers.
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    // The typed text is kept so it can be corrected, not silently replaced.
    expect(input.value).toBe('abc');
  });

  it('treats a value outside the range as invalid', async () => {
    setLocale('en');
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} min={0} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;

    await userEvent.type(input, '-3');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalledWith(-3);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('follows a value changed from outside while it is not focused', async () => {
    setLocale('en');
    render(<Harness initial={4.99} onCommit={vi.fn()} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;
    expect(input.value).toBe('4.99');

    await userEvent.click(screen.getByRole('button', { name: 'preset' }));
    expect(input.value).toBe('9.99');
  });

  it('shows the value in the new language’s convention when the language changes', () => {
    setLocale('en');
    render(<Harness initial={4.99} onCommit={vi.fn()} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;
    setLocale('fr');
    expect(input.value).toBe('4,99');
  });
});
