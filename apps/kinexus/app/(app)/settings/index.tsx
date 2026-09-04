import { SettingsDesktop } from '@/src/features/household/SettingsDesktop';
import { SettingsMobile } from '@/src/features/household/SettingsMobile';
import { useExperienceMode } from '@/src/lib/experience-mode';

export default function SettingsScreen() {
  const { mode } = useExperienceMode();
  return mode === 'desktop' ? <SettingsDesktop /> : <SettingsMobile />;
}
