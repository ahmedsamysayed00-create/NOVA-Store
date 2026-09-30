/*
# Phase 6: Revoke anon EXECUTE on new SECURITY DEFINER functions

## Summary
Revokes EXECUTE from anon role on adjust_inventory() and update_order_status() 
to eliminate security advisor warnings about anon being able to call these functions.

## Security
- adjust_inventory: EXECUTE revoked from anon, kept on authenticated
- update_order_status: EXECUTE revoked from anon, kept on authenticated
- Both functions check is_admin() internally, so authenticated non-admins are still rejected
*/

REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;