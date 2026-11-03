import { describe, expect, it } from 'vitest';
import { parsePreset, safeParsePresetList } from '@/domain/presets/schema';
import { DEFAULT_ROUNDING } from '@/domain/pricing/rounding';

const valid = {
  id: 'p1',
  name: 'Europe premium',
  description: 'Uplift for EUR markets',
  config: {
    strategy: { kind: 'percentage', percent: 10 },
    rounding: DEFAULT_ROUNDING,
    floorMicros: null,
    ceilingMicros: null,
  },
  regions: ['FR', 'DE'],
  createdAt: 1_700_000_000_000,
};

describe('preset validation', () => {
  it('accepts a well-formed preset', () => {
    expect(parsePreset(valid).name).toBe('Europe premium');
  });

  it('rejects an unknown strategy kind', () => {
    expect(() =>
      parsePreset({ ...valid, config: { ...valid.config, strategy: { kind: 'freeform' } } }),
    ).toThrow();
  });

  it('rejects lower-case or malformed region codes', () => {
    expect(() => parsePreset({ ...valid, regions: ['fr'] })).toThrow();
    expect(() => parsePreset({ ...valid, regions: ['FRA'] })).toThrow();
  });

  it('rejects a negative multiplier that would produce a negative price', () => {
    expect(() =>
      parsePreset({
        ...valid,
        config: { ...valid.config, strategy: { kind: 'multiplier', factor: -2 } },
      }),
    ).toThrow();
  });

  it('rejects a rounding ending outside [0, 1)', () => {
    expect(() =>
      parsePreset({
        ...valid,
        config: { ...valid.config, rounding: { ...DEFAULT_ROUNDING, endings: [1.5] } },
      }),
    ).toThrow();
  });

  it('caps a formula expression length rather than storing arbitrary text', () => {
    expect(() =>
      parsePreset({
        ...valid,
        config: {
          ...valid.config,
          strategy: { kind: 'formula', expression: 'x'.repeat(500), baseRegion: 'US' },
        },
      }),
    ).toThrow();
  });
});

describe('preset list import', () => {
  it('parses a valid export', () => {
    const result = safeParsePresetList([valid]);
    expect(result.ok).toBe(true);
  });

  it('reports which field is wrong instead of throwing', () => {
    const result = safeParsePresetList([{ ...valid, regions: ['nope'] }]);
    expect(result.ok).toBe(false);
    // `path` is what the interface shows; `error` is zod's English for the log.
    if (!result.ok) {
      expect(result.path).toBe('0.regions.0');
      expect(result.error).toMatch(/regions/);
    }
  });

  it('accepts maximum increase and decrease limits, and refuses a decrease beyond 100 %', () => {
    const limited = { ...valid, config: { ...valid.config, maxIncrease: 0.3, maxDecrease: 0.2 } };
    expect(parsePreset(limited).config.maxIncrease).toBe(0.3);
    expect(() =>
      parsePreset({ ...valid, config: { ...valid.config, maxDecrease: 1.5 } }),
    ).toThrow();
  });

  it('rejects a payload that is not a list at all', () => {
    const result = safeParsePresetList({ hello: 'world' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.path).toBe('—');
  });
});
