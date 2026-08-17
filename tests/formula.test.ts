import { describe, expect, it } from 'vitest';
import { evaluateFormula, FormulaError, validateFormula } from '@/domain/formula/parser';

const scope = { current: 4.99, base: 9.99 };

describe('formula evaluation', () => {
  it('evaluates the documented examples', () => {
    expect(evaluateFormula('current * 1.1', scope)).toBeCloseTo(5.489);
    expect(evaluateFormula('current * 0.8', scope)).toBeCloseTo(3.992);
    expect(evaluateFormula('base * 1.25', scope)).toBeCloseTo(12.4875);
  });

  it('respects operator precedence and parentheses', () => {
    expect(evaluateFormula('2 + 3 * 4', scope)).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', scope)).toBe(20);
  });

  it('handles unary minus', () => {
    expect(evaluateFormula('-current + 10', scope)).toBeCloseTo(5.01);
  });

  it('supports the bundled functions', () => {
    expect(evaluateFormula('min(current * 1.15, 5)', scope)).toBe(5);
    expect(evaluateFormula('max(1, 2, 3)', scope)).toBe(3);
    expect(evaluateFormula('round(4.567, 2)', scope)).toBe(4.57);
    expect(evaluateFormula('floor(4.9)', scope)).toBe(4);
    expect(evaluateFormula('ceil(4.1)', scope)).toBe(5);
    expect(evaluateFormula('abs(0 - 3)', scope)).toBe(3);
  });
});

describe('formula safety', () => {
  it('refuses unknown identifiers rather than treating them as zero', () => {
    expect(() => evaluateFormula('cost * 2', scope)).toThrow(FormulaError);
  });

  it('refuses unknown functions', () => {
    expect(() => evaluateFormula('pow(2, 3)', scope)).toThrow(/Unknown function/);
  });

  it('cannot reach the host environment', () => {
    for (const attack of [
      'globalThis',
      'process.exit(1)',
      'constructor',
      'this',
      '(() => 1)()',
      'window.alert(1)',
    ]) {
      expect(() => evaluateFormula(attack, scope)).toThrow();
    }
  });

  it('rejects division by zero instead of returning Infinity', () => {
    expect(() => evaluateFormula('current / 0', scope)).toThrow(/Division by zero/);
  });

  it('rejects trailing input and empty expressions', () => {
    expect(() => evaluateFormula('current 5', scope)).toThrow(/trailing/);
    expect(() => evaluateFormula('   ', scope)).toThrow(/empty/);
  });

  it('checks the argument count of functions', () => {
    expect(() => evaluateFormula('abs(1, 2)', scope)).toThrow(/takes/);
  });
});

describe('validateFormula', () => {
  it('accepts a valid expression', () => {
    expect(validateFormula('current * 1.1')).toEqual({ ok: true });
  });

  it('reports why an expression is invalid without throwing', () => {
    const result = validateFormula('current *');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
