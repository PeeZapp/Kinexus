declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW?: string;
    EXPO_PUBLIC_WEB_URL?: string;
    EXPO_PUBLIC_API_URL?: string;
    /** Local-only Watchlist TMDB/Trakt compare toggle. Never set in production builds. */
    EXPO_PUBLIC_WATCHLIST_DEV_SWITCH?: string;
  }
}
