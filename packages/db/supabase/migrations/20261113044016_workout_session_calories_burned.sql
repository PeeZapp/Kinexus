-- Approximate calories burned for completed workout sessions (nutrition-ready).

alter table public.workout_sessions
  add column calories_burned integer
  check (calories_burned is null or calories_burned >= 0);
