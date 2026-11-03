import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Zero hard-coded user-visible text: every word on screen comes from the
 * dictionary, so a French user never meets an English sentence. This parses
 * the interface with the TypeScript compiler and lists every literal a person
 * could read, as file:line, so the fix is obvious.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

/** Props that end up as visible or spoken text. */
const TEXT_PROPS = new Set([
  'title',
  'aria-label',
  'aria-description',
  'placeholder',
  'alt',
  'label',
  'hint',
  'description',
  'srLabel',
  'typePrompt',
  'confirmLabel',
  'backLabel',
  'newTabLabel',
]);

/**
 * Literal text that is the same in every language. Keep it tiny: each entry
 * must be a mark, not a word.
 */
const ALLOWED = new Set([
  'P.', // the logo mark
  '⇧P', // key cap for the launcher shortcut, aria-hidden
]);

const LETTER = /\p{L}/u;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : name.endsWith('.tsx') ? [path] : [];
  });
}

/** `&nbsp;`, `&#8209;` and friends are not words. */
const decode = (text: string) => text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, ' ');

function offends(text: string): boolean {
  const trimmed = decode(text).replace(/\s+/g, ' ').trim();
  return trimmed !== '' && LETTER.test(trimmed) && !ALLOWED.has(trimmed);
}

/** String literals an expression can evaluate to directly: `'a'`, `c ? 'a' : 'b'`, `x ?? 'a'`. */
function literalsIn(node: ts.Expression): ts.StringLiteralLike[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node];
  if (ts.isParenthesizedExpression(node)) return literalsIn(node.expression);
  if (ts.isConditionalExpression(node)) return [...literalsIn(node.whenTrue), ...literalsIn(node.whenFalse)];
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(
      node.operatorToken.kind,
    )
  ) {
    return literalsIn(node.right);
  }
  return [];
}

interface Offender {
  where: string;
  text: string;
}

function scanTsx(file: string): Offender[] {
  return scanTsxSource(
    ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  );
}

/** Text nodes, text props and literal children of every JSX element in a file. */
function scanTsxSource(source: ts.SourceFile): Offender[] {
  const out: Offender[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    out.push({ where: `${relative(ROOT, source.fileName)}:${line + 1}`, text: text.trim() });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && offends(node.text)) report(node, node.text);

    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(source))) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init) && offends(init.text)) report(init, init.text);
      if (init && ts.isJsxExpression(init) && init.expression) {
        for (const literal of literalsIn(init.expression)) if (offends(literal.text)) report(literal, literal.text);
      }
    }

    // `<p>{'Hello'}</p>` — a literal rendered as a child.
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const literal of literalsIn(node.expression)) if (offends(literal.text)) report(literal, literal.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** The content script builds its DOM from HTML strings: check the text between tags. */
function scanHtmlStrings(file: string): Offender[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: Offender[] = [];
  const visit = (node: ts.Node) => {
    const parts: { node: ts.Node; text: string }[] = [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) parts.push({ node, text: node.text });
    if (ts.isTemplateExpression(node)) {
      parts.push({ node: node.head, text: node.head.text });
      for (const span of node.templateSpans) parts.push({ node: span.literal, text: span.literal.text });
    }
    for (const part of parts) {
      if (!part.text.includes('<')) continue;
      // Text nodes, and attributes a person reads or hears.
      const texts = [
        ...[...part.text.matchAll(/>([^<>]+)</g)].map((m) => m[1]!),
        ...[...part.text.matchAll(/\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]!),
      ];
      for (const text of texts) {
        if (!offends(text)) continue;
        const { line } = source.getLineAndCharacterOfPosition(part.node.getStart(source));
        out.push({ where: `${relative(ROOT, file)}:${line + 1}`, text: text.trim() });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

describe('the scanner', () => {
  const scan = (code: string) => {
    const file = join(ROOT, 'tests', '__fixture__.tsx');
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return scanTsxSource(source).map((o) => o.text);
  };

  it('flags text, text props and literal children, and nothing else', () => {
    expect(
      scan(`const a = <div title="Close" className="flex px-4" data-act="close">
        Hello world
        {'Literal child'}
        {open ? 'Yes' : t('no')}
        <Button label={\`Save\`} hint={t('x')} aria-label={name ?? 'Fallback'} />
        <span>{count} · {fmt.delta(0.1)} — 12 %</span>
        <span>&nbsp;/&nbsp;</span>
        <img alt="" />
      </div>;`),
    ).toEqual(['Close', 'Hello world', 'Literal child', 'Yes', 'Save', 'Fallback']);
  });

  it('allows only the listed marks', () => {
    expect(scan(`const a = <span>P.</span>;`)).toEqual([]);
  });
});

describe('user-visible text', () => {
  it('comes from the dictionary in every screen', () => {
    const offenders = [
      ...sources(SRC).flatMap(scanTsx),
      ...scanHtmlStrings(join(SRC, 'content', 'ui.ts')),
    ].map((o) => `${o.where}  “${o.text}”`);
    expect(offenders).toEqual([]);
  });
});
