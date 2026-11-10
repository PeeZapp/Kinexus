import type { Href } from 'expo-router';
import { Redirect } from 'expo-router';

export default function StashReadlistRedirect() {
  return <Redirect href={'/lists/readlist' as Href} />;
}
