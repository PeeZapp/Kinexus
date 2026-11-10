import { ReadlistLayout, type ReadlistLayoutProps } from '@/src/features/readlist/ReadlistLayout';

export function ReadlistDesktop(props: Omit<ReadlistLayoutProps, 'desktop'>) {
  return <ReadlistLayout {...props} desktop />;
}
