import { PlanChoiceModal, type PlanChoiceOption } from '@/src/features/train/plan/PlanChoiceModal';

const OPTIONS = [
  {
    key: 'start',
    label: 'Start',
    detail: 'Blank session now',
  },
  {
    key: 'pick',
    label: 'Pick',
    detail: 'From your library',
  },
  {
    key: 'build',
    label: 'Build',
    detail: 'Remix or builder',
  },
] as const satisfies readonly PlanChoiceOption<'start' | 'pick' | 'build'>[];

export type AddWorkoutChoice = (typeof OPTIONS)[number]['key'];

export function AddWorkoutModal({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: AddWorkoutChoice) => void;
}) {
  return (
    <PlanChoiceModal
      visible={visible}
      title="Add workout"
      options={OPTIONS}
      onClose={onClose}
      onChoose={onChoose}
    />
  );
}
