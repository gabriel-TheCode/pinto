import { useChangeSet, useStore } from '@/app/store';
import { useT } from '@/i18n/react';
import { Badge } from '@/ui';

/**
 * The one line every step footer starts with: how many prices will change,
 * and how many need a look. Same words and same numbers on every step.
 */
export function ChangeSummary() {
  const t = useT();
  const changeSet = useChangeSet();
  const selected = useStore((state) => state.selection.size);
  const changed = changeSet?.summary.changed ?? 0;
  const blocked = changeSet?.summary.invalid ?? 0;
  const warnings = changeSet?.summary.warnings ?? 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
      <span className="truncate text-body font-medium text-ink-900">
        {changed
          ? t('workspace.summary.changes', { count: changed })
          : t('workspace.summary.none')}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-small text-ink-500">
        <span className="truncate">{t('workspace.summary.selected', { count: selected })}</span>
        {blocked > 0 && (
          <Badge tone="danger" icon="error">
            {t('workspace.summary.blocked', { count: blocked })}
          </Badge>
        )}
        {warnings > 0 && (
          <Badge tone="warn" icon="warning">
            {t('workspace.summary.warnings', { count: warnings })}
          </Badge>
        )}
      </span>
    </div>
  );
}
