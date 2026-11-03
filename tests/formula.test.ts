import { describe, expect, it } from 'vitest';
import { evaluateFormula, FormulaError, validateFormula } from '@/domain/formula/parser';

const scope = { current: 4.99, base: 9.99 };

/** The error a formula raises, as the code and params the interface words. */
function failure(expression: string): Pick<FormulaError, 'code' | 'params'> | null {
  try {
    evaluateFormula(expression, scope);
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(FormulaError);
    const { code, params } = error as FormulaError;
    return { code, params };
  }
}

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
    expect(failure('cost * 2')).toEqual({ code: 'unknown-name', params: { name: 'cost' } });
  });

  it('refuses unknown functions', () => {
    expect(failure('pow(2, 3)')).toEqual({ code: 'unknown-function', params: { name: 'pow' } });
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
    expect(failure('current / 0')?.code).toBe('division-by-zero');
    expect(failure('current % 0')?.code).toBe('division-by-zero');
  });

  it('rejects trailing input and empty expressions', () => {
    expect(failure('current 5')?.code).toBe('trailing-input');
    expect(failure('   ')?.code).toBe('empty');
    expect(failure('current *')?.code).toBe('unexpected-end');
    expect(failure('(current')).toEqual({ code: 'expected', params: { token: ')' } });
    expect(failure('current # 2')).toEqual({ code: 'unexpected-character', params: { char: '#' } });
    expect(failure('1.2.3')).toEqual({ code: 'not-a-number', params: { text: '1.2.3' } });
  });

  it('checks the argument count of functions', () => {
    expect(failure('abs(1, 2)')).toEqual({ code: 'arity', params: { name: 'abs', min: 1, max: 1 } });
  });
});

describe('validateFormula', () => {
  it('accepts a valid expression', () => {
    expect(validateFormula('current * 1.1')).toEqual({ ok: true });
  });

  it('reports why an expression is invalid without throwing', () => {
    const result = validateFormula('current *');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(FormulaError);
      expect(result.error.code).toBe('unexpected-end');
    }
  });
});
