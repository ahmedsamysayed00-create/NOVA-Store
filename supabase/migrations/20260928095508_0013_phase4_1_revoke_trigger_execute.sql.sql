-- Revoke EXECUTE on update_product_rating from authenticated and anon.
-- This is a trigger function called internally by the reviews trigger;
-- authenticated users should never call it directly via the REST API.
REVOKE EXECUTE ON FUNCTION public.update_product_rating() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_rating() FROM anon;
