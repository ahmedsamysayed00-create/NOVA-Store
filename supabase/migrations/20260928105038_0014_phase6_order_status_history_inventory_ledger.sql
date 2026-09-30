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