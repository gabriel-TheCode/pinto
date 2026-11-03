import { common } from './common';
import { content } from './content';
import { errors } from './errors';
import { help } from './help';
import { history } from './history';
import { issues } from './issues';
import { markets } from './markets';
import { onboarding } from './onboarding';
import { popup } from './popup';
import { regions } from './regions';
import { review } from './review';
import { settings } from './settings';
import { strategy } from './strategy';
import { workspace } from './workspace';

/**
 * English, the source locale. One file per area of the product; keys carry
 * their area as a prefix, so a key says where it is shown and two areas can
 * never collide. Add a namespace here and in every other locale's index.
 */
export const en = {
  ...common,
  ...content,
  ...errors,
  ...issues,
  ...regions,
  ...workspace,
  ...onboarding,
  ...strategy,
  ...markets,
  ...review,
  ...history,
  ...settings,
  ...help,
  ...popup,
} as const;
