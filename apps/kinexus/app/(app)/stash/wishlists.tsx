import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

export default function StashWishlistsRedirect() {
  return <Redirect href={'/lists/wishlists' as Href} />;
}
