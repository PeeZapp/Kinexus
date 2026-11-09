-- Stale TikTok short-link imports were cached under www.tiktok.com without a video id.
-- Age them past the failed-import retry window so a fresh resolve can run.

update public.recipe_imports
set
  updated_at = now() - interval '1 day',
  expires_at = now() - interval '1 second'
where
  status = 'failed'
  and canonical_url ~* '^https://www\.tiktok\.com/'
  and canonical_url !~* '/(video|photo)/[0-9]+';
