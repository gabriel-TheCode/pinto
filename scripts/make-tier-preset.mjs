/**
 * Generates a generic purchasing-power tier preset, usable by any app.
 * See `tier-table.mjs` for the table itself and why it lives outside `src/`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BANDS, CHARM, ROOT, buildAssignment } from './tier-table.mjs';

const SHARES = {
  'T1 · Premium': 1,
  'T2 · Established': 0.8,
  'T3 · Upper-mid': 0.6,
  'T4 · Lower-mid': 0.45,
  'T5 · Volume': 0.3,
};

const assignment = buildAssignment();

const preset = [
  {
    id: 'ppp-tiers-v1',
    name: 'Purchasing-power tiers',
    description:
      'Five-band ladder from the US price. A starting point based on income and observed app spend — review every band before applying.',
    config: {
      strategy: {
        kind: 'tiers',
        baseRegion: 'US',
        tiers: SHARES,
        assignment,
        convert: true,
      },
      rounding: CHARM,
      floorMicros: null,
      ceilingMicros: null,
    },
    regions: Object.keys(assignment).sort(),
    createdAt: Date.now(),
  },
];

mkdirSync(resolve(ROOT, 'presets'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'presets/purchasing-power-tiers.json'),
  `${JSON.stringify(preset, null, 2)}\n`,
);

console.log(`tier-preset: ${Object.keys(assignment).length} countries assigned`);
for (const [band, share] of Object.entries(SHARES)) {
  const count = Object.values(assignment).filter((value) => value === band).length;
  console.log(`  ${band.padEnd(18)} ${String(share * 100).padStart(3)}%  ${count} countries`);
}
console.log(`  bands defined: ${Object.keys(BANDS).length}`);
console.log('wrote presets/purchasing-power-tiers.json');
