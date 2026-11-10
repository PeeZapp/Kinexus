import { ReadlistLayout, type ReadlistLayoutProps } from '@/src/features/readlist/ReadlistLayout';

export function ReadlistMobile(props: Omit<ReadlistLayoutProps, 'desktop'>) {
  return <ReadlistLayout {...props} desktop={false} />;
}
