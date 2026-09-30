/*
# Phase 6: Integrate Inventory Ledger into place_order()

## Summary
Modifies place_order() to:
1. Create an inventory transaction record for each product stock decrement
2. Create an initial order_status_history record (old_status = null, new_status = 'pending')

## Changes to place_order()
- After each successful stock decrement, inserts into inventory_transactions:
  - quantity_change = -(quantity) (negative for order)
  - quantity_before = stock before decrement
  - quantity_after = stock after decrement
  - transaction_type = 'order'
  - reference_id = order_id
  - created_by = auth.uid()
- After order is fully created, inserts initial status history record

## Security
- SECURITY DEFINER with SET search_path = public (unchanged)
- All changes are atomic within the existing transaction
- If any part fails, everything rolls back (order, order_items, stock, inventory, cart)

## Important Notes
1. The stock decrement loop already uses FOR UPDATE OF p — now also captures stock before/after for ledger
2. The EXCEPTION handler catches all errors and returns safe message — no partial state
3. Initial history record has old_status = NULL to distinguish from transitions
*/