import { useLocalSearchParams } from 'expo-router';

import { InvestDetailScreen } from '@/src/features/finances/invest/InvestDetailScreen';

export default function FinancesInvestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <InvestDetailScreen itemId={id} />;
}
