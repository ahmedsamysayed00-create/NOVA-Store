/*
# Phase 6: Force revoke anon EXECUTE on SECURITY DEFINER functions

The previous REVOKE did not take effect because function recreation
in an earlier migration reset grants. This migration re-applies the revokes.
*/

-- Drop and recreate the functions' grant state
REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- Also revoke from place_order to be safe
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text) TO authenticated;