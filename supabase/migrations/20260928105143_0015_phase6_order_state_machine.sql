/*
# Phase 6: Order State Machine + Status History + Stock Restoration

## Summary
Replaces update_order_status() with a server-enforced state machine that:
1. Validates allowed transitions (rejects invalid ones)
2. Records every transition in order_status_history
3. Restores stock on cancellation (exactly once, idempotent)
4. Creates inventory transactions for stock restoration
5. Locks order row FOR UPDATE to prevent race conditions

## State Machine
Allowed transitions:
- pending → confirmed, cancelled
- confirmed → processing, cancelled
- processing → shipped, cancelled
- shipped → delivered
- delivered → (terminal)
- cancelled → (terminal)

## Security
- SECURITY DEFINER with SET search_path = public
- Admin-only (checks is_admin() internally)
- Non-admin and anonymous callers get safe error
- No SQL errors or internal details returned to client

## Stock Restoration on Cancellation
- Only restores stock for orders that had stock consumed (pending/confirmed/processing → cancelled)
- Uses FOR UPDATE lock on product rows
- Creates 'cancellation' inventory transactions
- Idempotent: cancelled → cancelled is rejected before any stock restoration
- Failed transitions create no history and no inventory changes

## Important Notes
1. The old update_order_status() was SECURITY INVOKER with no transition rules — now SECURITY DEFINER with full state machine
2. EXECUTE granted to authenticated, revoked from anon
3. Initial order creation history is handled by place_order() (next migration)
*/

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_is_admin boolean;
  v_current_status text;
  v_order_user_id uuid;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  v_allowed_transitions jsonb := '{
    "pending": ["confirmed", "cancelled"],
    "confirmed": ["processing", "cancelled"],
    "processing": ["shipped", "cancelled"],
    "shipped": ["delivered"],
    "delivered": [],
    "cancelled": []
  }'::jsonb;
  v_allowed_targets text[];
  v_item RECORD;
  v_product RECORD;
  v_stock_before int;
  v_stock_after int;
BEGIN
  -- Authorization: admin only
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  -- Validate requested status is a known status
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status.');
  END IF;

  -- Lock order row and read current status
  SELECT status, user_id INTO v_current_status, v_order_user_id
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
  END IF;

  -- No-op if same status
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is already ' || p_new_status || '.');
  END IF;

  -- Check if transition is allowed
  v_allowed_targets := ARRAY(
    SELECT jsonb_array_elements_text(v_allowed_transitions -> v_current_status)
  );

  IF NOT (p_new_status = ANY(v_allowed_targets)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot change order from ' || v_current_status || ' to ' || p_new_status || '.'
    );
  END IF;

  -- Perform status update
  UPDATE public.orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id;

  -- Record history
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, note)
  VALUES (p_order_id, v_current_status, p_new_status, auth.uid(), p_note);

  -- Stock restoration on cancellation
  IF p_new_status = 'cancelled' AND v_current_status IN ('pending', 'confirmed', 'processing') THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = p_order_id
      AND product_id IS NOT NULL
    LOOP
      -- Lock product row
      SELECT stock INTO v_stock_before
      FROM public.products
      WHERE id = v_item.product_id
      FOR UPDATE;

      v_stock_after := v_stock_before + v_item.quantity;

      UPDATE public.products
      SET stock = v_stock_after, updated_at = now()
      WHERE id = v_item.product_id;

      INSERT INTO public.inventory_transactions (
        product_id, quantity_change, quantity_before, quantity_after,
        transaction_type, reference_id, reason, created_by
      ) VALUES (
        v_item.product_id, v_item.quantity, v_stock_before, v_stock_after,
        'cancellation', p_order_id, 'Order cancelled', auth.uid()
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Grant EXECUTE to authenticated only, revoke from anon
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- Also revoke the old 2-arg version if it still exists
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text) CASCADE;