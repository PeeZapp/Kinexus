import { useLocalSearchParams } from 'expo-router';

import { WorkoutEditor } from '@/src/features/train/WorkoutEditor';

export default function TrainWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <WorkoutEditor workoutId={id} />;
}
