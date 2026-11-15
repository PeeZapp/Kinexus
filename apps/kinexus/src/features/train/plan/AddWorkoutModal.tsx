import { PlanChoiceModal, type PlanChoiceOption } from '@/src/features/train/plan/PlanChoiceModal';

const OPTIONS = [
  {
    key: 'type',
    label: 'Type',
    detail: 'No workout yet',
  },
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
] as const satisfies readonly PlanChoiceOption<'type' | 'start' | 'pick' | 'build'>[];

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
      title="Add to day"
      options={OPTIONS}
      onClose={onClose}
      onChoose={onChoose}
    />
  );
}
