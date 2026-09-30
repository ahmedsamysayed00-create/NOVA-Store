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