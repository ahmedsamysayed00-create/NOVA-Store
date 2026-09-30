/*
# NOVA Store Phase 2.5 — Security Hardening

## Overview
Fixes identified during the Phase 2.5 security audit. No new features.

## Changes

1. **get_cart_summary() → SECURITY INVOKER**
   This function only reads cart_items (owner-scoped by RLS) and
   shipping_config (public SELECT). It does not need elevated privileges.
   Converting to SECURITY INVOKER eliminates one security advisor warning
   without changing behavior — RLS already ensures the caller can only
   see their own cart items.

2. **update_order_status() → SECURITY INVOKER**
   This function checks is_admin() internally and returns 'Unauthorized'
   for non-admins before any UPDATE. With SECURITY INVOKER, the admin's
   UPDATE on orders succeeds because the orders UPDATE RLS policy allows
   is_admin(). Non-admins never reach the UPDATE. Converting to SECURITY
   INVOKER eliminates one security advisor warning.

3. **place_order() — remove SQLERRM from client response**
   The exception handler previously returned `'detail', SQLERRM` which
   leaks internal database error messages to the client. This is an
   information disclosure vulnerability. Removed.

4. **place_order() — store shipping address**
   The function accepted p_shipping_address but never stored it. Added
   shipping_address jsonb column to orders table and store the address
   at order creation time.

5. **cart_items — prevent product_id/user_id changes on UPDATE**
   Added a trigger that raises an error if a user attempts to change
   product_id or user_id on an existing cart item. The RLS WITH CHECK
   already prevents user_id changes, but product_id was unprotected.
   A malicious client could change product_id to swap their cart item
   to a different product. The trigger blocks this.

## Security Impact
- Eliminates 2 of 3 security advisor warnings (SECURITY DEFINER).
- Fixes information disclosure (SQLERRM leak).
- Fixes data loss (shipping address not persisted).
- Prevents cart item product_id manipulation.
*/

-- ============================================================
-- 1. get_cart_summary → SECURITY INVOKER
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cart_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_subtotal numeric(10, 2) := 0;
  v_shipping_cost numeric(10, 2) := 0;
  v_cod_fee numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_item_count int := 0;
  v_flat_rate numeric(10, 2);
  v_free_threshold numeric(10, 2);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('subtotal', 0, 'shipping_cost', 0, 'cod_fee', 0, 'total', 0, 'item_count', 0);
  END IF;

  SELECT flat_rate_fee, free_shipping_threshold, cod_fee
    INTO v_flat_rate, v_free_threshold, v_cod_fee
  FROM public.shipping_config WHERE id = 1;

  SELECT
    COALESCE(SUM(ci.quantity * p.price), 0),
    COALESCE(SUM(ci.quantity), 0)
    INTO v_subtotal, v_item_count
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = v_user_id AND p.is_active = true;

  IF v_subtotal >= v_free_threshold THEN
    v_shipping_cost := 0;
  ELSE
    v_shipping_cost := v_flat_rate;
  END IF;

  v_total := v_subtotal + v_shipping_cost + v_cod_fee;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping_cost,
    'cod_fee', v_cod_fee,
    'total', v_total,
    'item_count', v_item_count
  );
END;
$$;

-- ============================================================
-- 2. update_order_status → SECURITY INVOKER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_order_exists boolean;
  v_valid_statuses text[] := ARRAY['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
  END IF;

  UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3 & 4. place_order — remove SQLERRM leak, store shipping address
-- ============================================================

-- Add shipping_address column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;

CREATE OR REPLACE FUNCTION public.place_order(
  p_shipping_address jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart_items RECORD;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10, 2) := 0;
  v_shipping_cost numeric(10, 2) := 0;
  v_cod_fee numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_flat_rate numeric(10, 2);
  v_free_threshold numeric(10, 2);
  v_seq int;
  v_date_str text;
  v_count int := 0;
  v_line_total numeric(10, 2);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to place an order.');
  END IF;

  SELECT flat_rate_fee, free_shipping_threshold, cod_fee
    INTO v_flat_rate, v_free_threshold, v_cod_fee
  FROM public.shipping_config
  WHERE id = 1;

  v_date_str := to_char(now(), 'YYYYMMDD');
  SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
  FROM public.orders
  WHERE order_number LIKE 'NOVA-' || v_date_str || '-%';
  v_order_number := 'NOVA-' || v_date_str || '-' || lpad(v_seq::text, 4, '0');

  FOR v_cart_items IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock, p.is_active, p.name, p.sku
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = v_user_id
    FOR UPDATE OF p
  LOOP
    v_count := v_count + 1;

    IF NOT v_cart_items.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'Product "' || v_cart_items.name || '" is no longer available.');
    END IF;

    IF v_cart_items.stock < v_cart_items.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for "' || v_cart_items.name || '". Available: ' || v_cart_items.stock || ', requested: ' || v_cart_items.quantity);
    END IF;

    v_subtotal := v_subtotal + (v_cart_items.price * v_cart_items.quantity);
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your cart is empty.');
  END IF;

  IF v_subtotal >= v_free_threshold THEN
    v_shipping_cost := 0;
  ELSE
    v_shipping_cost := v_flat_rate;
  END IF;

  v_total := v_subtotal + v_shipping_cost + v_cod_fee;

  INSERT INTO public.orders (
    id, user_id, order_number, status,
    subtotal, shipping_cost, tax_amount, total,
    shipping_address, notes
  ) VALUES (
    gen_random_uuid(), v_user_id, v_order_number, 'pending',
    v_subtotal, v_shipping_cost, v_cod_fee, v_total,
    p_shipping_address, p_notes
  )
  RETURNING id INTO v_order_id;

  FOR v_cart_items IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name, p.sku
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = v_user_id
    FOR UPDATE OF p
  LOOP
    v_line_total := v_cart_items.price * v_cart_items.quantity;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_sku,
      unit_price, quantity, line_total
    ) VALUES (
      v_order_id, v_cart_items.product_id, v_cart_items.name, v_cart_items.sku,
      v_cart_items.price, v_cart_items.quantity, v_line_total
    );

    UPDATE public.products
      SET stock = stock - v_cart_items.quantity
      WHERE id = v_cart_items.product_id
      AND stock >= v_cart_items.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock changed during order placement for product %', v_cart_items.name;
    END IF;
  END LOOP;

  DELETE FROM public.cart_items WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while placing your order. Please try again.'
    );
END;
$$;

-- ============================================================
-- 5. cart_items — prevent product_id/user_id changes on UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_cart_item_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'Cannot change product_id on an existing cart item.';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id on an existing cart item.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cart_items_guard_cols ON public.cart_items;
CREATE TRIGGER trg_cart_items_guard_cols
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_cart_item_immutable_cols();
