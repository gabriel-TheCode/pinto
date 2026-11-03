import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The layers Pinto is built from, enforced. A rule here is cheaper than a
 * review comment: the pricing core stays pure, the design system never reaches
 * into the store, and nothing on the panel side pulls the service worker in.
 *
 *   domain ← i18n ← ui ← features ← app        (panel, popup)
 *   domain ← services ← background              (service worker)
 */

const SRC = resolve(__dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

interface Import {
  file: string;
  /** Top-level folder under src the import lands in, e.g. `domain`, `types`. */
  target: string;
  typeOnly: boolean;
  line: number;
}

function importsOf(file: string): Import[] {
  const out: Import[] = [];
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((text, index) => {
      const match = /^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+'([^']+)'/.exec(text);
      if (!match) return;
      const [, typeOnly, spec] = match;
      let path: string;
      if (spec!.startsWith('@/')) path = join(SRC, spec!.slice(2));
      else if (spec!.startsWith('.')) path = resolve(dirname(file), spec!);
      else return; // a package
      out.push({
        file: relative(SRC, file),
        target: relative(SRC, path).split('/')[0]!,
        typeOnly: !!typeOnly,
        line: index + 1,
      });
    });
  return out;
}

const ALL = files(SRC).flatMap(importsOf);
const layer = (file: string) => file.split('/')[0]!;

function violations(from: string[], forbidden: string[], { allowTypes = false } = {}): string[] {
  return ALL.filter((i) => from.includes(layer(i.file)) && forbidden.includes(i.target))
    .filter((i) => !(allowTypes && i.typeOnly))
    .map((i) => `${i.file}:${i.line} → ${i.target}`);
}

describe('layering', () => {
  it('finds the imports it checks', () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('keeps the pricing core pure: domain imports only domain and types', () => {
    const outside = ALL.filter((i) => layer(i.file) === 'domain' && !['domain', 'types'].includes(i.target));
    expect(outside.map((i) => `${i.file}:${i.line} → ${i.target}`)).toEqual([]);
  });

  it('keeps the design system free of screens, store and runtime calls', () => {
    expect(violations(['ui'], ['app', 'features', 'background'])).toEqual([]);
    // Message types describe what a primitive shows; calling the worker is not its job.
    expect(violations(['ui'], ['services'], { allowTypes: true })).toEqual([]);
  });

  it('keeps words out of the runtime: i18n never imports screens or the store', () => {
    expect(violations(['i18n'], ['app', 'features', 'ui', 'background'])).toEqual([]);
    expect(violations(['i18n'], ['services'], { allowTypes: true })).toEqual([]);
  });

  it('never pulls the service worker into a page', () => {
    expect(violations(['app', 'features', 'ui', 'i18n', 'popup', 'panel', 'content'], ['background'])).toEqual([]);
  });

  it('keeps React out of the service worker and the services', () => {
    expect(violations(['background', 'services'], ['app', 'features', 'ui'])).toEqual([]);
  });
});
