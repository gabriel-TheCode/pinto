import { useState } from 'react';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';
import { cx } from '@/lib/cx';

/**
 * User-defined country groups.
 *
 * Geography is a poor proxy for what a price should be — France and Romania
 * share a continent and very little else, and no re-cut of "Western Europe"
 * fixes that without smuggling an economic judgement into what looks like
 * reference data. So Pinto still ships no income tiers; instead it lets you
 * build the groupings your pricing actually uses, name them, and reuse them.
 *
 * Clicking a group *adds* to the selection rather than replacing it, so bands
 * can be composed — "EU high income" plus "Nordics" — without starting over.
 */
export function GroupBar() {
  const { groups, selection, addRegions, setSelection, saveGroup, deleteGroup } = useStore();
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');

  const commit = () => {
    const trimmed = label.trim();
    if (!trimmed || !selection.size) return;
    void saveGroup(trimmed, [...selection]);
    setLabel('');
    setNaming(false);
  };

  if (!groups.length && !naming) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-ink-200 bg-white px-3 py-1.5">
        <span className="flex-1 text-[11.5px] text-ink-400">
          Group the markets you price alike — Pinto ships no income tiers of its own.
        </span>
        <Button size="sm" variant="ghost" disabled={!selection.size} onClick={() => setNaming(true)}>
          Save selection as group
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-ink-200 bg-white px-3 py-1.5">
      {groups.map((group) => {
        const applied = group.members.every((member) => selection.has(member));
        return (
          <span
            key={group.id}
            className={cx(
              'group inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-[11.5px] transition-colors',
              applied
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            <button
              type="button"
              onClick={() => (applied ? setSelection([]) : addRegions(group.members))}
              title={
                applied
                  ? 'Every country in this group is selected — click to clear the selection'
                  : `Add ${group.members.length} countries to the selection`
              }
            >
              {group.label}
              <span className="ml-1 text-ink-400 tabular">{group.members.length}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete group ${group.label}`}
              title="Delete this group"
              onClick={() => void deleteGroup(group.id)}
              className="rounded-full px-1 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-fall-500 focus:opacity-100"
            >
              ✕
            </button>
          </span>
        );
      })}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') {
                setNaming(false);
                setLabel('');
              }
            }}
            placeholder={`Name for ${selection.size} countries`}
            aria-label="Group name"
            className="h-6 w-44 rounded-full border border-accent-500 px-2 text-[11.5px] focus:outline-none"
          />
          <Button size="sm" variant="ghost" disabled={!label.trim()} onClick={commit}>
            Save
          </Button>
        </span>
      ) : (
        <button
          type="button"
          disabled={!selection.size}
          onClick={() => setNaming(true)}
          className="rounded-full border border-dashed border-ink-300 px-2 py-0.5 text-[11.5px] text-ink-500 hover:border-ink-400 hover:text-ink-800 disabled:opacity-50"
        >
          + Save selection ({selection.size})
        </button>
      )}
    </div>
  );
}
