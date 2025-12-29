-- Inspect existing function(s) and indexes (optional diagnostics)
-- 1) List functions named waitlist_add_idempotent (shows argument & return types)
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'waitlist_add_idempotent';

-- 2) Show indexes on public.waitlist
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'waitlist';

-- ---------------------------------------------------------------------
--  Drop existing function (if present) to avoid "cannot change return type"
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.waitlist_add_idempotent(text, text);

-- ---------------------------------------------------------------------
-- Ensure pgcrypto extension for gen_random_uuid()
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Create idempotent waitlist insertion function
-- - SECURITY DEFINER with fixed search_path to avoid mutable search_path warnings.
-- - Returns TABLE(status text, waitlist_id uuid)
-- Behavior:
--   * Try to INSERT a row (id, created_at, name, email)
--   * If insert succeeds -> return status='inserted' and new id
--   * If unique_violation -> select existing id by case-insensitive email and return status='exists' and that id
-- Note: There is a unique expression index on lower(email) which causes a unique_violation on duplicates.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.waitlist_add_idempotent(p_name text, p_email text)
RETURNS TABLE(status text, waitlist_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _id uuid;
BEGIN
  -- Try to insert
  INSERT INTO public.waitlist (id, created_at, name, email)
  VALUES (gen_random_uuid(), now(), p_name, p_email)
  RETURNING id INTO _id;

  status := 'inserted';
  waitlist_id := _id;
  RETURN NEXT;
  RETURN;
EXCEPTION
  WHEN unique_violation THEN
    -- On unique violation (duplicate email), return existing id (case-insensitive match)
    SELECT id INTO _id
    FROM public.waitlist
    WHERE lower(email) = lower(p_email)
    LIMIT 1;

    status := 'exists';
    waitlist_id := _id;
    RETURN NEXT;
    RETURN;
END;
$$;

-- ---------------------------------------------------------------------
-- Granting execute:
-- We will be calling this RPC from server-side code (Next.js server route),
-- so granting to anon (public) is NOT necessary and NOT recommended.
-- If you want to allow direct client RPC calls (NOT recommended for service-role behavior),
-- you could run:
--   GRANT EXECUTE ON FUNCTION public.waitlist_add_idempotent(text, text) TO anon;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Helper: delete test rows (case-insensitive)
-- Example:
-- DELETE FROM public.waitlist WHERE lower(email) = lower('test+1@cocinavecinal.com');
-- ---------------------------------------------------------------------
