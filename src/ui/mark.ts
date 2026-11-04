/**
 * Pinto's mark: a P drawn as a price tag on the brand gradient. The bowl is
 * the tag, with a chamfered nose, and its round eyelet is the dot of the old
 * "P." mark.
 *
 * Every rendering reads these shapes: the extension icons
 * (scripts/generate-icons.mjs rasterises them), <Logo>, the launcher Pinto
 * puts in Play Console and the store tiles. Two drawings exist because one
 * cannot serve both ends: MARK for 24 px and up, MARK_16 for the toolbar,
 * snapped to whole pixels, where the eyelet becomes a square counter.
 */

export const BRAND = { from: '#FF9100', to: '#DF301C' } as const;

type Point = readonly [number, number];

export interface MarkDrawing {
  /** Side of the square tile, in drawing units. */
  size: number;
  radius: number;
  /** The P, as one closed polygon. */
  outline: readonly Point[];
  /** The counter cut out of the bowl: a circle, or a polygon when snapped. */
  hole: { circle: readonly [cx: number, cy: number, r: number] } | { polygon: readonly Point[] };
}

export const MARK: MarkDrawing = {
  size: 64,
  radius: 14,
  // Every edge on an even unit, so the 32 px icon lands on whole pixels.
  outline: [[20, 12], [36, 12], [46, 22], [46, 28], [36, 38], [28, 38], [28, 52], [20, 52]],
  hole: { circle: [34, 25, 5] },
};

export const MARK_16: MarkDrawing = {
  size: 16,
  radius: 3.5,
  outline: [[5, 3], [9, 3], [11, 5], [11, 7], [9, 9], [7, 9], [7, 13], [5, 13]],
  hole: { polygon: [[7, 5], [9, 5], [9, 7], [7, 7]] },
};

const polygonPath = (points: readonly Point[]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/** The white glyph as one even-odd path: the P minus its counter. */
export function markPath(drawing: MarkDrawing): string {
  const { hole } = drawing;
  if ('polygon' in hole) return polygonPath(drawing.outline) + polygonPath(hole.polygon);
  const [cx, cy, r] = hole.circle;
  return `${polygonPath(drawing.outline)}M${cx} ${cy - r}a${r} ${r} 0 1 0 0 ${2 * r}a${r} ${r} 0 1 0 0 ${-2 * r}Z`;
}

/**
 * The mark as an SVG string, for places that are not React. `id` names the
 * gradient, so it must be unique in its document or shadow root.
 */
export function markSvg(drawing: MarkDrawing, { id, size }: { id: string; size: number }): string {
  const s = drawing.size;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${BRAND.from}"/><stop offset="1" stop-color="${BRAND.to}"/></linearGradient></defs>` +
    `<rect width="${s}" height="${s}" rx="${drawing.radius}" fill="url(#${id})"/>` +
    `<path fill="#fff" fill-rule="evenodd" d="${markPath(drawing)}"/></svg>`
  );
}
