-- Track Google OAuth refresh failures so the app can prompt reconnect
-- instead of repeatedly hitting invalid_grant (Testing-mode 7-day expiry, revoke, etc.).

alter table public.user_google_calendar
  add column if not exists needs_reauth boolean not null default false,
  add column if not exists auth_error text;

alter table public.user_google_calendar
  drop constraint if exists user_google_calendar_auth_error_len;

alter table public.user_google_calendar
  add constraint user_google_calendar_auth_error_len
  check (auth_error is null or char_length(auth_error) between 1 and 500);

comment on column public.user_google_calendar.needs_reauth is
  'True when Google refresh failed (expired/revoked). User must reconnect; publish OAuth consent to Production to avoid 7-day Testing expiry.';
