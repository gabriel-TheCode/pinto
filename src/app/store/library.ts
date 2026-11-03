import { asPayload, send } from '@/services/client';
import { safeParsePresetList } from '@/domain/presets/schema';
import type { Preset } from '@/types';
import type { CustomGroup } from '@/domain/regions/groups';
import { toast } from '@/ui/toastStore';
import type { LibrarySlice, Slice } from './types';

/** Saved work the user brings back: presets (strategies) and country groups. */
export const createLibrarySlice: Slice<LibrarySlice> = (set, get) => ({
  presets: [],
  groups: [],

  async loadPresets() {
    try {
      set({ presets: ((await send({ type: 'presets/list' })) ?? []) as Preset[] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async savePreset(name, description, withSelection) {
    const { config, selection } = get();
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      description,
      config,
      regions: withSelection ? [...selection] : [],
      createdAt: Date.now(),
    };
    try {
      set({ presets: ((await send({ type: 'presets/save', preset })) ?? get().presets) as Preset[] });
      toast({ key: 'strategy.presets.saved', vars: { name } }, 'success');
    } catch (error) {
      toast({ error: asPayload(error) }, 'error');
    }
  },

  async deletePreset(id) {
    try {
      set({ presets: ((await send({ type: 'presets/delete', id })) ?? []) as Preset[] });
    } catch (error) {
      toast({ error: asPayload(error) }, 'error');
    }
  },

  applyPreset(preset) {
    set({
      config: preset.config,
      ...(preset.regions.length ? { selection: new Set(preset.regions) } : {}),
      step: 'strategy',
      view: 'workspace',
    });
    void get().ensureConversion();
    toast({ key: 'strategy.presets.applied', vars: { name: preset.name } }, 'success');
  },

  async importPresets(text) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      toast({ error: { code: 'preset/invalid-json', message: 'Invalid JSON', retryable: false } }, 'error');
      return;
    }
    const result = safeParsePresetList(json);
    if (!result.ok) {
      toast(
        {
          error: {
            code: 'preset/invalid-file',
            params: { path: result.path },
            message: result.error,
            retryable: false,
          },
        },
        'error',
      );
      return;
    }
    let imported = 0;
    try {
      for (const preset of result.presets) {
        await send({ type: 'presets/save', preset: { ...preset, id: crypto.randomUUID() } });
        imported += 1;
      }
    } catch (error) {
      toast({ error: asPayload(error) }, 'error');
    }
    await get().loadPresets();
    if (imported) toast({ key: 'strategy.presets.imported', vars: { count: imported } }, 'success');
  },

  async loadGroups() {
    try {
      // A malformed or empty response must not leave `groups` unset — the
      // group bar reads its length on every render.
      set({ groups: ((await send({ type: 'groups/list' })) ?? []) as CustomGroup[] });
    } catch (error) {
      set({ error: asPayload(error) });
    }
  },

  async saveGroup(label, members) {
    const group: CustomGroup = { id: crypto.randomUUID(), label, members, createdAt: Date.now() };
    try {
      set({ groups: await send({ type: 'groups/save', group }) });
      toast({ key: 'markets.groups.saved', vars: { name: label, count: members.length } }, 'success');
    } catch (error) {
      toast({ error: asPayload(error) }, 'error');
    }
  },

  async deleteGroup(id) {
    try {
      set({ groups: (await send({ type: 'groups/delete', id })) ?? [] });
    } catch (error) {
      toast({ error: asPayload(error) }, 'error');
    }
  },
});
