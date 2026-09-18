import type { ChecklistsLayoutProps } from './ChecklistsDesktop';
import { ChecklistsMobile as Layout } from './ChecklistsDesktop';

export function ChecklistsMobile(props: ChecklistsLayoutProps) {
  return <Layout {...props} />;
}
