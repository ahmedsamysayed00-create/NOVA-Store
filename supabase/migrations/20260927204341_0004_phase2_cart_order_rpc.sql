/*
# NOVA Store Phase 2 — Cart, Order RPC, Shipping Config

## Overview
Adds persistent cart storage, a secure atomic order-placement RPC function,
and a centralized shipping configuration table.

## New Tables

1. **cart_items** — Persistent shopping cart for authenticated users.
   - `id` (uuid PK)
   - `user_id` (uuid, defaults to auth.uid(), FK to auth.users)
   - `product_id` (uuid, FK to products)
   - `quantity` (int, check > 0)
   - `created_at`, `updated_at` timestamps
   - Unique constraint on (user_id, product_id) — one row per product per cart

2. **shipping_config** — Single-row configuration table for shipping rules.
   - `id` (int PK, always 1)
   - `flat_rate_fee` (numeric, default 5.00)
   - `free_shipping_threshold` (numeric, default 75.00)
   - `cod_fee` (numeric, default 0 — Cash on Delivery surcharge)
   - `updated_at` timestamp

## New Functions

1. **place_order(p_shipping_address jsonb, p_notes text)** — SECURITY DEFINER RPC
   that atomically creates an order from the caller's cart. This is the
   authoritative order-creation path:
   - Validates the user is authenticated
   - Reads the user's cart_items joined with products
   - Verifies each product is active and has sufficient stock
   - Reads authoritative current prices from the products table (NOT client-supplied)
   - Calculates subtotal, shipping (from shipping_config), and total
   - Creates the order row with a generated order_number
   - Creates order_items with purchase-time prices and product names
   - Atomically decrements stock (with race-condition safety via UPDATE ... WHERE stock >= qty)
   - Clears the user's cart
   - Returns the order id and order_number
   - All in a single transaction — if any step fails, the entire order is rolled back

2. **get_cart_summary()** — SECURITY DEFINER RPC that returns the authoritative
   cart totals (subtotal, shipping, total) calculated from current product
   prices. Used for checkout display so the client never computes totals.

## Security Changes (RLS)

- **cart_items**: Owner-scoped CRUD (SELECT/INSERT/UPDATE/DELETE), each
  policy checks `auth.uid() = user_id`. user_id defaults to auth.uid().
- **shipping_config**: Public SELECT (anon + authenticated). Admin-only
  INSERT/UPDATE/DELETE via is_admin().

## Important Notes

1. The place_order function uses `FOR UPDATE` row-level locks on products
   during stock decrement, preventing race conditions where two customers
   buy the last item simultaneously.
2. Order numbers are generated as `NOVA-YYYYMMDD-XXXX` format.
3. The function rejects empty carts, inactive products, and insufficient
   stock with clear error messages.
4. shipping_config is seeded with a single default row.
*/

-- ============================================================
-- SHIPPING CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  flat_rate_fee numeric(10, 2) NOT NULL DEFAULT 5.00 CHECK (flat_rate_fee >= 0),
  free_shipping_threshold numeric(10, 2) NOT NULL DEFAULT 75.00 CHECK (free_shipping_threshold >= 0),
  cod_fee numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (cod_fee >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_config_select_public" ON public.shipping_config;
CREATE POLICY "shipping_config_select_public"
  ON public.shipping_config FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "shipping_config_update_admin" ON public.shipping_config;
CREATE POLICY "shipping_config_update_admin"
  ON public.shipping_config FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shipping_config_insert_admin" ON public.shipping_config;
CREATE POLICY "shipping_config_insert_admin"
  ON public.shipping_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Seed default row
INSERT INTO public.shipping_config (id, flat_rate_fee, free_shipping_threshold, cod_fee)
VALUES (1, 5.00, 75.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CART ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product ON public.cart_items(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own"
  ON public.cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own"
  ON public.cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own"
  ON public.cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own"
  ON public.cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_items_updated_at') THEN
    CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON public.cart_items
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

-- ============================================================
-- PLACE ORDER RPC
-- ============================================================

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
  v_product_name text;
  v_product_sku text;
  v_product_price numeric(10, 2);
  v_product_stock int;
  v_product_active boolean;
BEGIN
  -- Validate authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to place an order.');
  END IF;

  -- Read shipping config
  SELECT flat_rate_fee, free_shipping_threshold, cod_fee
    INTO v_flat_rate, v_free_threshold, v_cod_fee
  FROM public.shipping_config
  WHERE id = 1;

  -- Generate order number: NOVA-YYYYMMDD-XXXX
  v_date_str := to_char(now(), 'YYYYMMDD');
  SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
  FROM public.orders
  WHERE order_number LIKE 'NOVA-' || v_date_str || '-%';
  v_order_number := 'NOVA-' || v_date_str || '-' || lpad(v_seq::text, 4, '0');

  -- Calculate subtotal from authoritative product data
  FOR v_cart_items IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock, p.is_active, p.name, p.sku
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = v_user_id
    FOR UPDATE OF p
  LOOP
    v_count := v_count + 1;

    -- Validate product is active
    IF NOT v_cart_items.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'Product "' || v_cart_items.name || '" is no longer available.');
    END IF;

    -- Validate stock
    IF v_cart_items.stock < v_cart_items.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for "' || v_cart_items.name || '". Available: ' || v_cart_items.stock || ', requested: ' || v_cart_items.quantity);
    END IF;

    v_subtotal := v_subtotal + (v_cart_items.price * v_cart_items.quantity);
  v_count := v_count;
  PERFORM 1; -- no-op to keep loop valid
  END LOOP;

  -- Reject empty cart
  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your cart is empty.');
  END IF;

  -- Calculate shipping
  IF v_subtotal >= v_free_threshold THEN
    v_shipping_cost := 0;
  ELSE
    v_shipping_cost := v_flat_rate;
  END IF;

  -- Calculate total (subtotal + shipping + cod_fee)
  v_total := v_subtotal + v_shipping_cost + v_cod_fee;

  -- Create the order
  INSERT INTO public.orders (
    id, user_id, order_number, status,
    subtotal, shipping_cost, tax_amount, total,
    notes
  ) VALUES (
    gen_random_uuid(), v_user_id, v_order_number, 'pending',
    v_subtotal, v_shipping_cost, v_cod_fee, v_total,
    p_notes
  )
  RETURNING id INTO v_order_id;

  -- Create order items and decrement stock
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

    -- Atomically decrement stock — only succeeds if stock is sufficient
    UPDATE public.products
      SET stock = stock - v_cart_items.quantity
      WHERE id = v_cart_items.product_id
      AND stock >= v_cart_items.quantity;

    IF NOT FOUND THEN
      -- Race condition: stock changed between check and decrement
      RAISE EXCEPTION 'Stock changed during order placement for product %', v_cart_items.name;
    END IF;
  END LOOP;

  -- Clear the cart
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
      'error', 'An error occurred while placing your order. Please try again.',
      'detail', SQLERRM
    );
END;
$$;

-- Revoke execute from anon — only authenticated users can place orders
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text) TO authenticated;

-- ============================================================
-- GET CART SUMMARY RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cart_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.get_cart_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cart_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cart_summary() TO authenticated;

-- ============================================================
-- ORDER STATUS UPDATE RPC (admin only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text) TO authenticated;
