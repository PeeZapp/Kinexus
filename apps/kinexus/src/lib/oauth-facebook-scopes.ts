/**
 * Facebook avatar link / re-auth only — request public_profile from our side.
 * Supabase Auth’s Facebook provider always prepends `email` and appends these
 * scopes (no supported override); Meta must allow `email` on the app use case.
 * @see https://github.com/supabase/auth/blob/master/internal/api/provider/facebook.go
 * @see https://supabase.com/docs/guides/auth/social-login/auth-facebook
 */
export const FACEBOOK_AVATAR_SCOPES = 'public_profile';
