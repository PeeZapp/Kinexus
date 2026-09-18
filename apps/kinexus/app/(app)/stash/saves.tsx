import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

export default function StashSavesRedirect() {
  return <Redirect href={'/lists/saves' as Href} />;
}
