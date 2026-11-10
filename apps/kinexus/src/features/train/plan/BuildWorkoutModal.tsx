import { PlanChoiceModal, type PlanChoiceOption } from '@/src/features/train/plan/PlanChoiceModal';

const OPTIONS = [
  {
    key: 'remix',
    label: 'Remix',
    detail: 'Quick mix from categories',
  },
  {
    key: 'builder',
    label: 'Builder',
    detail: 'Build exercise by exercise',
  },
] as const satisfies readonly PlanChoiceOption<'remix' | 'builder'>[];

export type BuildWorkoutChoice = (typeof OPTIONS)[number]['key'];

export function BuildWorkoutModal({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: BuildWorkoutChoice) => void;
}) {
  return (
    <PlanChoiceModal
      visible={visible}
      title="Build workout"
      options={OPTIONS}
      onClose={onClose}
      onChoose={onChoose}
    />
  );
}
