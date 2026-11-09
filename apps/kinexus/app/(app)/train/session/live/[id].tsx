import { useLocalSearchParams } from 'expo-router';

import { SessionScreen } from '@/src/features/train/SessionScreen';

export default function LiveTrainSession() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId?: string }>();
  if (!id) return null;
  return <SessionScreen liveSessionId={id} planDayId={typeof dayId === 'string' ? dayId : undefined} />;
}
