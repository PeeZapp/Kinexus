import type { ImageSourcePropType } from 'react-native';

import {
  AVATAR_PRESET_IDS,
  AVATAR_PRESET_LABELS,
  DEFAULT_AVATAR_PRESET,
  type AvatarPresetId,
} from '@/src/lib/identity-avatar';

export type AvatarPresetOption = {
  id: AvatarPresetId;
  label: string;
  source: ImageSourcePropType;
};

const PRESET_SOURCES: Record<AvatarPresetId, ImageSourcePropType> = {
  'preset:today': require('../../../assets/images/nav/nav-today.png'),
  'preset:calendar': require('../../../assets/images/nav/nav-calendar.png'),
  'preset:meals': require('../../../assets/images/nav/nav-meals.png'),
  'preset:lists': require('../../../assets/images/nav/nav-lists.png'),
  'preset:finances': require('../../../assets/images/nav/nav-money.png'),
  'preset:nutrition': require('../../../assets/images/nav/nav-nutrition.png'),
  'preset:train': require('../../../assets/images/nav/nav-train.png'),
  'preset:settings': require('../../../assets/images/nav/nav-more.png'),
};

export const AVATAR_PRESETS: readonly AvatarPresetOption[] = AVATAR_PRESET_IDS.map((id) => ({
  id,
  label: AVATAR_PRESET_LABELS[id],
  source: PRESET_SOURCES[id],
}));

export function avatarPresetSource(id: AvatarPresetId = DEFAULT_AVATAR_PRESET): ImageSourcePropType {
  return PRESET_SOURCES[id] ?? PRESET_SOURCES[DEFAULT_AVATAR_PRESET];
}
