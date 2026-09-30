import { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, Loader2, Clock, User as UserIcon } from 'lucide-react';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/components/common/product-price';
import type { Order, OrderItem, Profile, OrderStatusHistory } from '@/types/database';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-primary/10 text-primary',
  processing: 'bg-primary/10 text-primary',
  shipped: 'bg-accent/10 text-accent',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

const allowedTransitions: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const filterStatuses = ['all', ...validStatuses] as const;

interface AdminOrder extends Order {
  order_items: OrderItem[];
  profiles: Pick<Profile, 'id' | 'email' | 'full_name'> | null;
  order_status_history: OrderStatusHistory[];
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('orders')
        .select('*, order_items(*), profiles:user_id(id, email, full_name), order_status_history(*)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: err } = await query.limit(50);
      if (err) throw err;
      const rows = (data ?? []) as unknown as AdminOrder[];
      rows.forEach((row) => {
        row.order_status_history.sort(
          (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
        );
      });
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleStatusUpdate(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    setUpdateError(null);
    try {
      const { data, error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }> })
        .rpc('update_order_status', {
          p_order_id: orderId,
          p_new_status: newStatus,
        });

      if (rpcError) {
        setUpdateError('Failed to update order status.');
        setUpdatingId(null);
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        setUpdateError(result.error ?? 'Failed to update order status.');
        setUpdatingId(null);
        return;
      }

      await loadOrders();
    } catch {
      setUpdateError('An error occurred while updating the order.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <LoadingSection label="Loading orders" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {filterStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {updateError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {updateError}
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description={statusFilter !== 'all' ? 'No orders match this status filter.' : 'Orders will appear here once customers start purchasing.'}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
            const possibleTargets = allowedTransitions[order.status] ?? [];
            const isTerminal = order.status === 'delivered' || order.status === 'cancelled';
            const history = order.order_status_history ?? [];
            return (
              <div key={order.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.profiles?.email ?? 'Unknown'} · {new Date(order.created_at).toLocaleDateString()} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('rounded-full px-3 py-1 text-xs font-medium uppercase', statusColors[order.status] ?? 'bg-muted text-muted-foreground')}>
                      {order.status}
                    </span>
                    <span className="font-bold text-foreground">{formatPrice(order.total)}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 animate-in">
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Items */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</h4>
                        <div className="space-y-2">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-foreground">{item.product_name} × {item.quantity}</span>
                              <span className="font-medium text-foreground">{formatPrice(item.line_total)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1 border-t border-border pt-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_cost === 0 ? 'Free' : formatPrice(order.shipping_cost)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">COD Fee</span><span>{formatPrice(order.tax_amount)}</span></div>
                          <div className="flex justify-between font-semibold"><span>Total</span><span>{formatPrice(order.total)}</span></div>
                        </div>
                      </div>

                      {/* Customer + status + history */}
                      <div className="space-y-5">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h4>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-foreground">{order.profiles?.full_name ?? '—'}</p>
                            <p className="text-muted-foreground">{order.profiles?.email ?? '—'}</p>
                          </div>
                        </div>

                        {order.notes && (
                          <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Notes</h4>
                            <p className="text-sm text-foreground">{order.notes}</p>
                          </div>
                        )}

                        {/* Status transition controls */}
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update Status</h4>
                          {isTerminal ? (
                            <p className="text-sm text-muted-foreground">
                              This order is {order.status}. No further status changes are allowed.
                            </p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {possibleTargets.map((target) => (
                                <Button
                                  key={target}
                                  size="sm"
                                  variant={target === 'cancelled' ? 'destructive' : 'default'}
                                  disabled={updatingId === order.id}
                                  onClick={() => handleStatusUpdate(order.id, target)}
                                >
                                  {target === 'cancelled' ? 'Cancel Order' : `Mark as ${target.charAt(0).toUpperCase() + target.slice(1)}`}
                                </Button>
                              ))}
                              {updatingId === order.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            </div>
                          )}
                        </div>

                        {/* Status history timeline */}
                        {history.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status History</h4>
                            <div className="space-y-2">
                              {history.map((h) => (
                                <div key={h.id} className="flex items-start gap-3 text-sm">
                                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-foreground">
                                      {h.old_status ? (
                                        <span className="capitalize">{h.old_status}</span>
                                      ) : (
                                        <span className="text-muted-foreground">Order created</span>
                                      )}
                                      {' → '}
                                      <span className="font-medium capitalize">{h.new_status}</span>
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <UserIcon className="h-3 w-3" />
                                      <span>{new Date(h.changed_at).toLocaleString()}</span>
                                    </div>
                                    {h.note && (
                                      <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
