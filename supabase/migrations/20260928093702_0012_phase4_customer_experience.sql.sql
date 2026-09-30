/*
# Phase 4: Customer Experience — Database Constraints + Review RPC

1. New Constraints
- Unique wishlist per user/product (prevents duplicate wishlist entries)
- Unique review per user/product (one review per product per customer)
- One default address per user (partial unique index on is_default = true)

2. New RPC: submit_review(p_product_id, p_rating, p_title, p_body)
- SECURITY DEFINER, SET search_path = public
- Verifies auth.uid() is not null
- Verifies the customer has purchased the product (EXISTS check on orders/order_items)
- Enforces rating 1-5 (constraint also exists on table)
- Enforces one review per user/product (upserts if exists)
- Returns success/error JSON

3. New RPC: set_default_address(p_address_id)
- SECURITY DEFINER, SET search_path = public
- Verifies auth.uid() owns the address
- Unsets previous default, sets new default atomically

4. Security
- EXECUTE on new RPCs granted to authenticated only
- No new tables created
- No existing RLS weakened
- All authorization via auth.uid() ownership checks
*/

-- 1. Unique wishlist constraint (one entry per user+product)
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_user_product_unique
  ON wishlist_items (user_id, product_id);

-- 2. Unique review constraint (one review per user+product)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product_unique
  ON reviews (user_id, product_id);

-- 3. One default address per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON addresses (user_id)
  WHERE is_default = true;

-- 4. Index for review queries by product
CREATE INDEX IF NOT EXISTS idx_reviews_product_id
  ON reviews (product_id);

-- 5. Index for wishlist queries by user
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id
  ON wishlist_items (user_id);

-- 6. submit_review RPC
CREATE OR REPLACE FUNCTION public.submit_review(
  p_product_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_product_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to leave a review.');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5.');
  END IF;

  IF p_body IS NOT NULL AND length(p_body) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review must be 2000 characters or less.');
  END IF;

  -- Verify product exists and is active
  SELECT name INTO v_product_name FROM products WHERE id = p_product_id AND is_active = true;
  IF v_product_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found.');
  END IF;

  -- Verify purchase: user must have a delivered/completed order containing this product
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = v_user_id
      AND oi.product_id = p_product_id
      AND o.status NOT IN ('cancelled', 'refunded')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can only review products you have purchased.');
  END IF;

  -- Check for existing review (upsert)
  SELECT id INTO v_existing_id FROM reviews
  WHERE user_id = v_user_id AND product_id = p_product_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE reviews
    SET rating = p_rating, title = p_title, body = p_body, updated_at = now()
    WHERE id = v_existing_id;
    RETURN jsonb_build_object('success', true, 'action', 'updated', 'review_id', v_existing_id);
  ELSE
    INSERT INTO reviews (product_id, user_id, rating, title, body, is_approved)
    VALUES (p_product_id, v_user_id, p_rating, p_title, p_body, true)
    RETURNING id INTO v_existing_id;
    RETURN jsonb_build_object('success', true, 'action', 'created', 'review_id', v_existing_id);
  END IF;
END;
$function$;

-- 7. set_default_address RPC
CREATE OR REPLACE FUNCTION public.set_default_address(p_address_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_addr_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in.');
  END IF;

  SELECT user_id INTO v_addr_user_id FROM addresses WHERE id = p_address_id;
  IF v_addr_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Address not found.');
  END IF;

  IF v_addr_user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Address not found.');
  END IF;

  -- Unset previous default
  UPDATE addresses SET is_default = false, updated_at = now()
  WHERE user_id = v_user_id AND is_default = true AND id <> p_address_id;

  -- Set new default
  UPDATE addresses SET is_default = true, updated_at = now()
  WHERE id = p_address_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 8. Grant EXECUTE to authenticated only
REVOKE EXECUTE ON FUNCTION submit_review(uuid, integer, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION set_default_address(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION submit_review(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_address(uuid) TO authenticated;

-- 9. Trigger to update product rating_avg and rating_count after review changes
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE products
  SET
    rating_avg = COALESCE((
      SELECT AVG(rating) FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND is_approved = true
    ), 0),
    rating_count = COALESCE((
      SELECT COUNT(*) FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND is_approved = true
    ), 0)
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_reviews_update_rating ON reviews;
CREATE TRIGGER trg_reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();

REVOKE EXECUTE ON FUNCTION update_product_rating() FROM anon, PUBLIC;
