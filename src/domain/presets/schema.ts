import { z } from 'zod';
import type { Preset } from '@/types';

/**
 * Presets can arrive from an imported JSON file, so they are the one place
 * where untrusted data enters Pinto's domain model. A preset that slipped
 * through malformed would surface later as a silently wrong price, so it is
 * parsed rather than cast.
 */

const roundingSchema = z.object({
  mode: z.enum(['none', 'charm', 'endings', 'integer']),
  endings: z.array(z.number().min(0).lt(1)).max(12),
  zeroDecimalStep: z.number().int().positive().max(1_000_000),
});

const regionCode = z.string().regex(/^[A-Z]{2}$/, 'Expected a two-letter region code');

const strategySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('percentage'), percent: z.number().min(-100).max(1000) }),
  z.object({ kind: z.literal('multiplier'), factor: z.number().positive().max(100) }),
  z.object({
    kind: z.literal('fixed'),
    micros: z.number().int().nonnegative(),
    baseRegion: regionCode,
    convert: z.boolean(),
  }),
  z.object({
    kind: z.literal('formula'),
    expression: z.string().min(1).max(200),
    baseRegion: regionCode,
  }),
  z.object({
    kind: z.literal('tiers'),
    baseRegion: regionCode,
    tiers: z.record(z.string(), z.number().min(0).max(10)),
    assignment: z.record(regionCode, z.string()),
    convert: z.boolean(),
    anchorMicros: z.number().int().nonnegative().max(1e12).optional(),
  }),
  z.object({ kind: z.literal('copy'), fromRegion: regionCode, convert: z.boolean() }),
]);

export const strategyConfigSchema = z.object({
  strategy: strategySchema,
  rounding: roundingSchema,
  floorMicros: z.number().int().nonnegative().nullable(),
  ceilingMicros: z.number().int().nonnegative().nullable(),
  overrides: z.record(regionCode, z.number().int().nonnegative().max(1e12)).optional(),
});

export const presetSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  description: z.string().max(280).default(''),
  config: strategyConfigSchema,
  regions: z.array(regionCode).max(400).default([]),
  createdAt: z.number().int().positive(),
});

export const presetListSchema = z.array(presetSchema).max(200);

export function parsePreset(value: unknown): Preset {
  return presetSchema.parse(value) as Preset;
}

export function safeParsePresetList(
  value: unknown,
): { ok: true; presets: Preset[] } | { ok: false; error: string } {
  const result = presetListSchema.safeParse(value);
  if (result.success) return { ok: true, presets: result.data as Preset[] };
  const first = result.error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.join('.') || 'file'}: ${first.message}` : 'Invalid preset file',
  };
}
