import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

export default function StashListsRedirect() {
  return <Redirect href={'/lists' as Href} />;
}
