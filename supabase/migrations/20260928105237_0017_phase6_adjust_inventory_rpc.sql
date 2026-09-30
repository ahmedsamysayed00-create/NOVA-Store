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

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_quantity_change integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_is_admin boolean;
  v_stock_before int;
  v_stock_after int;
  v_tx_type text;
  v_product_name text;
BEGIN
  -- Authorization: admin only
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  -- Validate quantity_change is non-zero
  IF p_quantity_change = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity change must not be zero.');
  END IF;

  -- Lock product row and read current stock
  SELECT stock, name INTO v_stock_before, v_product_name
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found.');
  END IF;

  -- Compute new stock
  v_stock_after := v_stock_before + p_quantity_change;

  -- Prevent negative stock
  IF v_stock_after < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock. Current: ' || v_stock_before || ', requested change: ' || p_quantity_change
    );
  END IF;

  -- Determine transaction type
  IF p_quantity_change > 0 THEN
    v_tx_type := 'restock';
  ELSE
    v_tx_type := 'adjustment';
  END IF;

  -- Update product stock
  UPDATE public.products
  SET stock = v_stock_after, updated_at = now()
  WHERE id = p_product_id;

  -- Create inventory transaction
  INSERT INTO public.inventory_transactions (
    product_id, quantity_change, quantity_before, quantity_after,
    transaction_type, reason, created_by
  ) VALUES (
    p_product_id, p_quantity_change, v_stock_before, v_stock_after,
    v_tx_type, COALESCE(p_reason, v_tx_type || ' adjustment'), auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'product_name', v_product_name,
    'stock_before', v_stock_before,
    'stock_after', v_stock_after,
    'transaction_type', v_tx_type
  );
END;
$function$;

-- Grant EXECUTE to authenticated only
REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) TO authenticated;