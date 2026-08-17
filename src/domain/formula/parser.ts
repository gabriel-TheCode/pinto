/**
 * A tiny, dependency-free expression evaluator for price formulas.
 *
 * `eval` and `new Function` are deliberately not used: the extension runs with
 * a strict MV3 CSP, and executing user text as code in a tool that writes real
 * prices would be indefensible. This is a hand-written Pratt parser over a
 * closed grammar — numbers, four operators, parentheses, a fixed set of
 * variables and a fixed set of functions. Nothing else can be expressed.
 */

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly position?: number,
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

type Token =
  | { type: 'number'; value: number; pos: number }
  | { type: 'ident'; value: string; pos: number }
  | { type: 'op'; value: string; pos: number }
  | { type: 'eof'; pos: number };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  round: ([v, d = 0]) => roundTo(v!, d!),
  floor: ([v, d = 0]) => stepTo(Math.floor, v!, d!),
  ceil: ([v, d = 0]) => stepTo(Math.ceil, v!, d!),
  abs: ([v]) => Math.abs(v!),
};

const FUNCTION_ARITY: Record<string, [number, number]> = {
  min: [1, 8],
  max: [1, 8],
  round: [1, 2],
  floor: [1, 2],
  ceil: [1, 2],
  abs: [1, 1],
};

function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function stepTo(fn: (n: number) => number, value: number, digits: number): number {
  const f = 10 ** digits;
  return fn(value * f) / f;
}

export const FORMULA_VARIABLES = ['current', 'base'] as const;
export type FormulaVariable = (typeof FORMULA_VARIABLES)[number];
export type FormulaScope = Record<FormulaVariable, number>;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      while (i < input.length && /[0-9.]/.test(input[i]!)) i++;
      const text = input.slice(start, i);
      const value = Number(text);
      if (!Number.isFinite(value)) throw new FormulaError(`Not a number: "${text}"`, start);
      tokens.push({ type: 'number', value, pos: start });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z_0-9]/.test(input[i]!)) i++;
      tokens.push({ type: 'ident', value: input.slice(start, i), pos: start });
      continue;
    }
    if ('+-*/%(),'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected character "${ch}"`, i);
  }
  tokens.push({ type: 'eof', pos: input.length });
  return tokens;
}

const BINDING_POWER: Record<string, number> = { '+': 10, '-': 10, '*': 20, '/': 20, '%': 20 };

class Parser {
  private index = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly scope: FormulaScope,
  ) {}

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private next(): Token {
    return this.tokens[this.index++]!;
  }

  private expect(op: string): void {
    const token = this.next();
    if (token.type !== 'op' || token.value !== op) {
      throw new FormulaError(`Expected "${op}"`, token.pos);
    }
  }

  parse(): number {
    const value = this.expression(0);
    const token = this.peek();
    if (token.type !== 'eof') throw new FormulaError('Unexpected trailing input', token.pos);
    return value;
  }

  private expression(minBp: number): number {
    let left = this.unary();
    for (;;) {
      const token = this.peek();
      if (token.type !== 'op') break;
      const bp = BINDING_POWER[token.value];
      if (bp === undefined || bp < minBp) break;
      this.next();
      const right = this.expression(bp + 1);
      left = apply(token.value, left, right, token.pos);
    }
    return left;
  }

  private unary(): number {
    const token = this.peek();
    if (token.type === 'op' && (token.value === '-' || token.value === '+')) {
      this.next();
      const value = this.unary();
      return token.value === '-' ? -value : value;
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.next();
    if (token.type === 'number') return token.value;
    if (token.type === 'op' && token.value === '(') {
      const value = this.expression(0);
      this.expect(')');
      return value;
    }
    if (token.type === 'ident') {
      const name = token.value.toLowerCase();
      const nextToken = this.peek();
      if (nextToken.type === 'op' && nextToken.value === '(') {
        this.next();
        const args: number[] = [];
        const first = this.peek();
        const empty = first.type === 'op' && first.value === ')';
        if (!empty) {
          for (;;) {
            args.push(this.expression(0));
            const sep = this.peek();
            if (sep.type === 'op' && sep.value === ',') {
              this.next();
              continue;
            }
            break;
          }
        }
        this.expect(')');
        const fn = FUNCTIONS[name];
        const arity = FUNCTION_ARITY[name];
        if (!fn || !arity) throw new FormulaError(`Unknown function "${name}"`, token.pos);
        if (args.length < arity[0] || args.length > arity[1]) {
          throw new FormulaError(`"${name}" takes ${arity[0]}–${arity[1]} arguments`, token.pos);
        }
        return fn(args);
      }
      if (name in this.scope) return this.scope[name as FormulaVariable];
      throw new FormulaError(
        `Unknown name "${token.value}". Available: ${FORMULA_VARIABLES.join(', ')}`,
        token.pos,
      );
    }
    throw new FormulaError('Unexpected end of expression', token.pos);
  }
}

function apply(op: string, left: number, right: number, pos: number): number {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      if (right === 0) throw new FormulaError('Division by zero', pos);
      return left / right;
    case '%':
      if (right === 0) throw new FormulaError('Division by zero', pos);
      return left % right;
    default:
      throw new FormulaError(`Unsupported operator "${op}"`, pos);
  }
}

/** Evaluates a formula against price *units* (not micros). */
export function evaluateFormula(expression: string, scope: FormulaScope): number {
  if (!expression.trim()) throw new FormulaError('Formula is empty');
  const result = new Parser(tokenize(expression), scope).parse();
  if (!Number.isFinite(result)) throw new FormulaError('Formula did not produce a number');
  return result;
}

/** Cheap syntax check for live UI feedback, using neutral sample values. */
export function validateFormula(expression: string): { ok: true } | { ok: false; error: string } {
  try {
    evaluateFormula(expression, { current: 4.99, base: 4.99 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid formula' };
  }
}
