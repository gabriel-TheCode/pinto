import { z } from 'zod';
import type { CustomGroup } from './groups';

/**
 * Custom country groups are user-authored and round-trip through storage and
 * preset files, so they are parsed at the boundary rather than trusted.
 */
export const customGroupSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  members: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(400),
  createdAt: z.number().int().positive(),
});

export function parseCustomGroup(value: unknown): CustomGroup {
  const parsed = customGroupSchema.parse(value);
  // Duplicates would inflate the member count shown in the UI.
  return { ...parsed, members: [...new Set(parsed.members)] };
}
