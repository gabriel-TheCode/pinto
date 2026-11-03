import { useT } from '@/i18n/react';
import { IS_MAC, Kbd, MOD_LABEL } from '@/ui';

/** Every keyboard shortcut Pinto has, shown in Settings and in Help. */
export function ShortcutTable() {
  const t = useT();
  const shift = IS_MAC ? '⇧' : t('settings.keys.shift');
  const rows: [keys: string[], action: string][] = [
    [[shift, 'P'], t('settings.keys.toggle')],
    [['/'], t('settings.keys.search')],
    [[MOD_LABEL, 'A'], t('settings.keys.selectAll')],
    [[MOD_LABEL, '↵'], t('settings.keys.next')],
    [[t('settings.keys.esc')], t('settings.keys.close')],
  ];
  return (
    <table className="w-full text-small">
      <thead className="sr-only">
        <tr>
          <th scope="col">{t('settings.keys.shortcut')}</th>
          <th scope="col">{t('settings.keys.action')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {rows.map(([keys, action]) => (
          <tr key={action}>
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">
              <span className="inline-flex gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </td>
            <td className="py-1.5 text-ink-700">{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
