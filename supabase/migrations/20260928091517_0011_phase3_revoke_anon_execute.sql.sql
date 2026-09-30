/*
# Phase 3.1: Security Advisor Fix — Revoke EXECUTE from anon for admin RPCs

The security advisor flagged that all new SECURITY DEFINER functions
are callable by the `anon` role. By default, PostgreSQL grants EXECUTE
to PUBLIC (which includes anon). We must revoke that and grant only
to `authenticated`.

These functions all validate is_admin() internally, so even if anon
calls them, they return empty/null results. But we should still
remove the attack surface.
*/

REVOKE EXECUTE ON FUNCTION get_admin_dashboard_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_sales_over_time(int) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_top_products(int) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_customer_overview() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION safe_delete_product(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION safe_delete_category(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION check_category_cycle(uuid, uuid) FROM anon, PUBLIC;
