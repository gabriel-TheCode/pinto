import type { Translation } from '@/i18n/core';
import type { en } from '../en';
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

export const fr: Translation<typeof en> = {
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
};
