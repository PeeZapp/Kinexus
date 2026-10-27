import { useLocalSearchParams } from 'expo-router';

import { SessionScreen } from '@/src/features/train/SessionScreen';

export default function LiveTrainSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <SessionScreen liveSessionId={id} />;
}
