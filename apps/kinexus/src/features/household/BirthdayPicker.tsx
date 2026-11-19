import { IsoDatePicker } from '@/src/features/household/IsoDatePicker';

export function BirthdayPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const maxYear = new Date().getFullYear();
  return (
    <IsoDatePicker
      label="Birthday"
      value={value}
      onChange={onChange}
      minYear={maxYear - 120}
      maxYear={maxYear}
      yearOrder="desc"
    />
  );
}
