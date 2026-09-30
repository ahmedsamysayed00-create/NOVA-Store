/*
# Phase 6: Inventory Adjustment RPC

## Summary
Creates adjust_inventory() SECURITY DEFINER function for admin stock management.

## Function: adjust_inventory(p_product_id, p_quantity_change, p_reason)
- Admin-only (checks is_admin() internally)
- Locks product row FOR UPDATE
- Validates quantity_change is non-zero
- Validates resulting stock >= 0
- Updates product stock
- Creates inventory_transaction record
- All atomic within single transaction

## Parameters
- p_product_id: UUID of product to adjust
- p_quantity_change: Integer (positive for restock, negative for decrease)
- p_reason: Optional text reason for adjustment

## Security
- SECURITY DEFINER with SET search_path = public
- EXECUTE granted to authenticated, revoked from anon
- Non-admin callers get safe "Unauthorized." error
- Anonymous callers get safe error (auth.uid() is null → is_admin() returns false)

## Transaction Types
- Positive quantity_change → transaction_type = 'restock'
- Negative quantity_change → transaction_type = 'adjustment'

## Important Notes
1. This is the ONLY way admin UI should adjust stock — never direct product table updates
2. Prevents negative stock via CHECK constraint and explicit validation
3. Every adjustment creates a permanent audit trail entry
*/