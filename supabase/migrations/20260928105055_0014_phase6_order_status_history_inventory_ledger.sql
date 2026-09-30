/*
# Phase 6: Order Status History + Inventory Ledger Tables

## Summary
Creates two new audit tables and updates the orders status constraint to add 'confirmed' status.

## New Tables

### order_status_history
- `id` (uuid PK, gen_random_uuid)
- `order_id` (uuid NOT NULL, FK to orders.id ON DELETE CASCADE)
- `old_status` (text, nullable — null for initial creation)
- `new_status` (text NOT NULL)
- `changed_by` (uuid NOT NULL, FK to auth.users ON DELETE SET NULL)
- `changed_at` (timestamptz NOT NULL DEFAULT now())
- `note` (text, nullable — reason for change)

### inventory_transactions
- `id` (uuid PK, gen_random_uuid)
- `product_id` (uuid NOT NULL, FK to products.id ON DELETE CASCADE)
- `quantity_change` (integer NOT NULL — positive or negative)
- `quantity_before` (integer NOT NULL)
- `quantity_after` (integer NOT NULL)
- `transaction_type` (text NOT NULL, CHECK in 'order','restock','adjustment','cancellation')
- `reference_id` (uuid, nullable — order_id for order/cancellation)
- `reason` (text, nullable)
- `created_by` (uuid, nullable, FK to auth.users ON DELETE SET NULL)
- `created_at` (timestamptz NOT NULL DEFAULT now())

## Constraints
- `inventory_transactions.quantity_after >= 0`
- `inventory_transactions.quantity_before >= 0`
- `inventory_transactions.transaction_type` CHECK valid types

## Modified Tables
- `orders` status CHECK constraint: replaced to include 'confirmed' status
  Old: pending, processing, shipped, delivered, cancelled, refunded
  New: pending, confirmed, processing, shipped, delivered, cancelled

## Security (RLS)
### order_status_history
- SELECT: authenticated users can read history for their own orders; admins can read all
- INSERT/UPDATE/DELETE: no direct client access (only via SECURITY DEFINER functions)

### inventory_transactions
- SELECT: admin only
- INSERT/UPDATE/DELETE: no direct client access (only via SECURITY DEFINER functions)

## Important Notes
1. The 'refunded' status is removed from the CHECK constraint since payments are not in this phase.
2. Existing orders with 'refunded' status would fail the new constraint — but no orders currently use it.
3. History and ledger records are append-only — no UPDATE or DELETE policies for clients.
*/

-- ============================================================
-- 1. Update orders status CHECK constraint
-- ============================================================

-- First, check if any orders currently have 'refunded' status
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE status = 'refunded';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot update status constraint: % orders have refunded status. Please handle them first.', v_count;
  END IF;
END $$;

-- Drop old constraint and add new one with 'confirmed' and without 'refunded'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text]));

-- ============================================================
-- 2. Create order_status_history table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON public.order_status_history(order_id, changed_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Customers can read history for their own orders; admins can read all
DROP POLICY IF EXISTS "history_select_own_or_admin" ON public.order_status_history;
CREATE POLICY "history_select_own_or_admin"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
    )
  );

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER functions can write

-- ============================================================
-- 3. Create inventory_transactions table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_change integer NOT NULL,
  quantity_before integer NOT NULL,
  quantity_after integer NOT NULL,
  transaction_type text NOT NULL,
  reference_id uuid,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_tx_type_check
    CHECK (transaction_type IN ('order', 'restock', 'adjustment', 'cancellation')),
  CONSTRAINT inventory_tx_qty_before_check
    CHECK (quantity_before >= 0),
  CONSTRAINT inventory_tx_qty_after_check
    CHECK (quantity_after >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_product_id
  ON public.inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_reference_id
  ON public.inventory_transactions(reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Admin only can read inventory transactions
DROP POLICY IF EXISTS "inventory_tx_select_admin" ON public.inventory_transactions;
CREATE POLICY "inventory_tx_select_admin"
  ON public.inventory_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER functions can write