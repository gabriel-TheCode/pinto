import { useId, useMemo, useState, type FormEvent } from 'react';
import { useStore } from '@/app/store';
import { Rich, useFormat, useT } from '@/i18n/react';
import type { CustomGroup } from '@/domain/regions/groups';
import { toPayload } from '@/lib/errors';
import { cx } from '@/lib/cx';
import type { RegionCode } from '@/types';
import { announce, Button, ConfirmDialog, Dialog, IconButton, TextField, toast } from '@/ui';

/**
 * The user's own country groups. A click selects only the group's countries
 * (what people expect from a saved selection); Shift+click adds them, so
 * groups compose. A chip is pressed when the selection is exactly the group.
 * Only countries this product is priced in are selected, so a group never
 * drags in a country Play would refuse.
 */
export function GroupBar({ priced }: { priced: readonly RegionCode[] }) {
  const t = useT();
  const fmt = useFormat();
  const labelId = useId();
  const formId = useId();
  const groups = useStore((state) => state.groups);
  const selection = useStore((state) => state.selection);
  const setSelection = useStore((state) => state.setSelection);
  const addRegions = useStore((state) => state.addRegions);
  const saveGroup = useStore((state) => state.saveGroup);
  const deleteGroup = useStore((state) => state.deleteGroup);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<CustomGroup | null>(null);
  const pricedSet = useMemo(() => new Set(priced), [priced]);

  const closeNaming = () => {
    setNaming(false);
    setName('');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const label = name.trim();
    if (!label || !selection.size) return;
    void saveGroup(label, [...selection]);
    closeNaming();
  };

  return (
    <div className="flex flex-col gap-2 border-b border-ink-200 bg-white px-4 py-2.5">
      {groups.length > 0 && (
        <>
          <span id={labelId} className="text-small font-medium text-ink-700">
            {t('markets.groups.label')}
          </span>
          <ul aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
            {groups.map((group) => {
              const members = group.members.filter((member) => pricedSet.has(member));
              const pressed =
                members.length > 0 &&
                members.length === selection.size &&
                members.every((member) => selection.has(member));
              return (
                <li
                  key={group.id}
                  className={cx(
                    'inline-flex min-w-0 items-center rounded-md border',
                    pressed ? 'border-accent-500 bg-accent-50' : 'border-ink-200 bg-white',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={pressed}
                    disabled={!members.length}
                    onClick={(event) => {
                      if (event.shiftKey) addRegions(members);
                      else setSelection(members);
                      announce(t('workspace.summary.selected', { count: useStore.getState().selection.size }));
                    }}
                    className={cx(
                      'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-l-md pr-1 pl-2.5 text-small disabled:cursor-not-allowed disabled:text-ink-500',
                      pressed ? 'font-medium text-accent-700' : 'text-ink-800 hover:bg-ink-50',
                    )}
                  >
                    <span className="truncate" title={group.label}>
                      {group.label}
                    </span>
                    <span aria-hidden="true" className="text-meta text-ink-500 tabular">
                      {fmt.number(members.length)}
                    </span>
                    <span className="sr-only">{t('count.countries', { count: members.length })}</span>
                  </button>
                  <IconButton
                    size="sm"
                    icon="close"
                    label={t('markets.groups.delete', { name: group.label })}
                    onClick={() => setDeleting(group)}
                    className="mr-0.5"
                  />
                </li>
              );
            })}
          </ul>
          <p className="text-meta text-ink-500">
            <Rich text={t('markets.groups.hint')} />
          </p>
        </>
      )}

      <Button
        size="sm"
        variant="ghost"
        icon="plus"
        className="-ml-2.5 self-start"
        disabled={!selection.size}
        onClick={() => setNaming(true)}
      >
        {t('markets.groups.save')}
      </Button>

      <Dialog
        open={naming}
        onClose={closeNaming}
        title={t('markets.groups.save')}
        description={t('markets.groups.saveBody', { count: selection.size })}
        footer={
          <>
            <Button variant="ghost" onClick={closeNaming}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" type="submit" form={formId} disabled={!name.trim()}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save}>
          <TextField
            label={t('markets.groups.name')}
            placeholder={t('markets.groups.namePlaceholder')}
            value={name}
            maxLength={60}
            autoComplete="off"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteGroup(deleting.id).catch((error: unknown) => toast({ error: toPayload(error) }, 'error'));
        }}
        title={deleting ? t('markets.groups.deleteTitle', { name: deleting.label }) : ''}
        description={t('markets.groups.deleteBody')}
        confirmLabel={t('action.delete')}
        tone="danger"
      />
    </div>
  );
}
