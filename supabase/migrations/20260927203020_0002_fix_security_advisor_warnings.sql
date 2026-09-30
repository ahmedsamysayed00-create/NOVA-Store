/*
# Fix Security Advisor Warnings

## Changes

1. **handle_updated_at()**: Add `SET search_path = public` to fix the
   "mutable search_path" warning. This function is a simple trigger helper
   that only sets `NEW.updated_at = now()` — no security risk, but the
   linter wants an explicit search_path.

2. **handle_new_user()**: Revoke EXECUTE from anon and authenticated roles.
   This is a trigger function called internally by the auth.users trigger —
   it should never be callable via the REST API. We revoke public execute
   and only allow the postgres/superuser role (which runs triggers) to use it.

3. **is_admin()**: Revoke EXECUTE from anon. Keep it callable by
   `authenticated` since RLS policies reference it — Postgres evaluates
   policies with the table owner's privileges, but the function itself
   needs to be callable in the policy context. However, to prevent direct
   REST API calls by anon users, we revoke from anon only.

## Security Impact
- Closes the REST API surface for trigger functions.
- is_admin remains usable inside RLS policies (which run with elevated
  privileges) but is not directly callable by unauthenticated users.
*/

-- Fix 1: handle_updated_at — add explicit search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: handle_new_user — revoke public execute, keep for trigger use only
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Fix 3: is_admin — revoke from anon (RLS policies still work since they
-- run with the table owner's privileges, not the caller's)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
