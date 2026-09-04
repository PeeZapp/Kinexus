declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW?: string;
    EXPO_PUBLIC_WEB_URL?: string;
    EXPO_PUBLIC_API_URL?: string;
  }
}
