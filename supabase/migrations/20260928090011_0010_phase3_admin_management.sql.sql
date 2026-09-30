/*
# Phase 3: Admin Management — Storage, Analytics RPCs, Safe Delete, Constraints

## Purpose
Turn the admin shell into a real administration system by adding:
1. Supabase Storage bucket for product images + security policies
2. Analytics RPCs for dashboard, sales chart, top products, customer overview
3. Safe delete RPCs for products and categories (protect historical orders)
4. Category cycle prevention RPC
5. Database constraints (price >= 0, stock >= 0, no self-parenting categories)
6. Indexes for admin query performance

## Storage
- Creates `product-images` bucket (public read, admin-only write)
- Storage policies: anon/authenticated can SELECT, only admin can INSERT/UPDATE/DELETE

## RPCs (all SECURITY DEFINER, check is_admin() internally)
- get_admin_dashboard_stats(): revenue, orders, customers, products, low stock, pending
- get_sales_over_time(p_days): daily revenue + order count for last N days
- get_top_products(p_limit): products ranked by units sold (excludes cancelled/refunded orders)
- get_customer_overview(): all profiles with order count + total spent
- safe_delete_product(p_product_id): soft-deletes if in order_items, hard-deletes otherwise
- safe_delete_category(p_category_id): refuses if has products or children
- check_category_cycle(p_category_id, p_new_parent_id): returns true if cycle detected

## Constraints
- products.price >= 0
- products.stock >= 0
- products.compare_at_price >= 0 (when not null)
- categories.parent_id != id (no self-referencing)

## Indexes
- idx_orders_created_at (for sales chart grouping)
- idx_products_is_active (for admin status filter)
- idx_products_stock (for low stock queries)

## Security
- All RPCs use SECURITY DEFINER with SET search_path = public
- All RPCs validate is_admin() before executing
- EXECUTE granted to authenticated only
- Storage policies use direct profile check for reliability
*/

-- ============================================================
-- 1. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. STORAGE POLICIES
-- ============================================================

-- Public read: anyone can view product images
DROP POLICY IF EXISTS "product_images_storage_read" ON storage.objects;
CREATE POLICY "product_images_storage_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Admin-only upload
DROP POLICY IF EXISTS "product_images_storage_upload" ON storage.objects;
CREATE POLICY "product_images_storage_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin-only update
DROP POLICY IF EXISTS "product_images_storage_update" ON storage.objects;
CREATE POLICY "product_images_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin-only delete
DROP POLICY IF EXISTS "product_images_storage_delete" ON storage.objects;
CREATE POLICY "product_images_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- 3. CONSTRAINTS
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_price_check' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_check' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_compare_at_price_check' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_compare_at_price_check
      CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_no_self_parent' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_no_self_parent
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products (stock) WHERE stock <= 10;

-- ============================================================
-- 5. ANALYTICS RPCs
-- ============================================================

-- Dashboard stats: single-call aggregate
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric;
  v_total_orders bigint;
  v_total_customers bigint;
  v_total_products bigint;
  v_low_stock_count bigint;
  v_pending_orders bigint;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
  FROM orders WHERE status NOT IN ('cancelled', 'refunded');

  SELECT COUNT(*) INTO v_total_orders FROM orders;

  SELECT COUNT(*) INTO v_total_customers FROM profiles WHERE role = 'customer';

  SELECT COUNT(*) INTO v_total_products FROM products;

  SELECT COUNT(*) INTO v_low_stock_count
  FROM products WHERE stock <= 10 AND is_active = true;

  SELECT COUNT(*) INTO v_pending_orders
  FROM orders WHERE status = 'pending';

  RETURN json_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'total_customers', v_total_customers,
    'total_products', v_total_products,
    'low_stock_count', v_low_stock_count,
    'pending_orders_count', v_pending_orders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;

-- Sales over time: daily revenue + order count for last N days
CREATE OR REPLACE FUNCTION get_sales_over_time(p_days int DEFAULT 30)
RETURNS TABLE(date text, revenue numeric, order_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d::text,
    COALESCE(SUM(o.total), 0)::numeric,
    COUNT(o.id)::bigint
  FROM generate_series(
    (CURRENT_DATE - (p_days - 1) * interval '1 day')::date,
    CURRENT_DATE,
    interval '1 day'
  ) d
  LEFT JOIN orders o
    ON o.created_at::date = d::date
    AND o.status NOT IN ('cancelled', 'refunded')
  GROUP BY d
  ORDER BY d;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_over_time(int) TO authenticated;

-- Top products by units sold (excludes cancelled/refunded orders)
CREATE OR REPLACE FUNCTION get_top_products(p_limit int DEFAULT 10)
RETURNS TABLE(product_id uuid, name text, units_sold bigint, revenue numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    oi.product_id,
    p.name,
    SUM(oi.quantity)::bigint,
    SUM(oi.line_total)::numeric
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.status NOT IN ('cancelled', 'refunded')
    AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id, p.name
  ORDER BY units_sold DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_products(int) TO authenticated;

-- Customer overview: all profiles with order count + total spent
CREATE OR REPLACE FUNCTION get_customer_overview()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  order_count bigint,
  total_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at,
    COUNT(o.id)::bigint,
    COALESCE(
      SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'refunded')),
      0
    )::numeric
  FROM profiles p
  LEFT JOIN orders o ON o.user_id = p.id
  GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_overview() TO authenticated;

-- ============================================================
-- 6. SAFE DELETE RPCs
-- ============================================================

-- Safe delete product: soft-delete if in order_items, hard-delete otherwise
CREATE OR REPLACE FUNCTION safe_delete_product(p_product_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_item_count int;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if product is referenced by historical order items
  SELECT COUNT(*) INTO v_order_item_count
  FROM order_items
  WHERE product_id = p_product_id;

  IF v_order_item_count > 0 THEN
    -- Soft delete: deactivate to preserve historical order integrity
    UPDATE products SET is_active = false WHERE id = p_product_id;
    RETURN json_build_object(
      'success', true,
      'action', 'deactivated',
      'message', 'Product deactivated — it is referenced by '
        || v_order_item_count
        || ' order item(s). Historical order data is preserved.'
    );
  END IF;

  -- No order items: safe to hard delete
  -- Clean up all references first
  DELETE FROM cart_items WHERE product_id = p_product_id;
  DELETE FROM wishlist_items WHERE product_id = p_product_id;
  DELETE FROM reviews WHERE product_id = p_product_id;
  DELETE FROM product_images WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;

  RETURN json_build_object(
    'success', true,
    'action', 'deleted',
    'message', 'Product permanently deleted.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION safe_delete_product(uuid) TO authenticated;

-- Safe delete category: refuses if has products or children
CREATE OR REPLACE FUNCTION safe_delete_category(p_category_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_count int;
  v_child_count int;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check for products in this category
  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE category_id = p_category_id;

  IF v_product_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot delete — '
        || v_product_count
        || ' product(s) are assigned to this category. Reassign or deactivate them first.'
    );
  END IF;

  -- Check for child categories
  SELECT COUNT(*) INTO v_child_count
  FROM categories
  WHERE parent_id = p_category_id;

  IF v_child_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot delete — '
        || v_child_count
        || ' child categor(y/ies) exist. Delete or reassign them first.'
    );
  END IF;

  -- Safe to delete
  DELETE FROM categories WHERE id = p_category_id;

  RETURN json_build_object(
    'success', true,
    'action', 'deleted',
    'message', 'Category permanently deleted.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION safe_delete_category(uuid) TO authenticated;

-- ============================================================
-- 7. CATEGORY CYCLE CHECK
-- ============================================================

-- Returns true if assigning p_new_parent_id to p_category_id creates a cycle
CREATE OR REPLACE FUNCTION check_category_cycle(
  p_category_id uuid,
  p_new_parent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_id uuid;
  v_depth int := 0;
BEGIN
  IF NOT is_admin() THEN
    RETURN true; -- fail safe
  END IF;

  -- Self-reference is a cycle
  IF p_category_id = p_new_parent_id THEN
    RETURN true;
  END IF;

  -- No parent means no cycle
  IF p_new_parent_id IS NULL THEN
    RETURN false;
  END IF;

  -- Walk up the tree from the proposed parent; if we reach p_category_id, it's a cycle
  v_current_id := p_new_parent_id;
  WHILE v_current_id IS NOT NULL AND v_depth < 100 LOOP
    IF v_current_id = p_category_id THEN
      RETURN true;
    END IF;
    SELECT parent_id INTO v_current_id FROM categories WHERE id = v_current_id;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION check_category_cycle(uuid, uuid) TO authenticated;
