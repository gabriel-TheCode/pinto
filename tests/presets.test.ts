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
    if (!result.ok) expect(result.error).toMatch(/regions/);
  });

  it('rejects a payload that is not a list at all', () => {
    expect(safeParsePresetList({ hello: 'world' }).ok).toBe(false);
  });
});
