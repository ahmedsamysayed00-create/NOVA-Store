/*
# NOVA Store — Fix place_order seq column reference

## Bug
The `place_order()` function references `MAX(seq)` on the `orders`
table, but `orders` has no `seq` column. The exception handler catches
the "column does not exist" error and returns a generic failure message,
making all order placements fail.

## Fix
Extract the sequence number from the `order_number` string using a
regex substring instead of referencing a non-existent column.
*/

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
  SELECT COALESCE(MAX(substring(order_number from 'NOVA-[0-9]{8}-([0-9]+)')::int), 0) + 1
    INTO v_seq
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

-- Re-grant execute to authenticated only
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text) TO authenticated;
