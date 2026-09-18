import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

export default function StashWatchlistRedirect() {
  return <Redirect href={'/lists/watchlist' as Href} />;
}
