import { useEffect, useState, useCallback } from 'react';
import { Package, ChevronDown, ChevronUp, Clock, MapPin, XCircle, Loader2 } from 'lucide-react';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { formatPrice } from '@/components/common/product-price';
import type { OrderWithItems, OrderStatusHistory } from '@/types/database';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-primary/10 text-primary',
  processing: 'bg-primary/10 text-primary',
  shipped: 'bg-accent/10 text-accent',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const cancellableStatuses = ['pending', 'confirmed', 'processing'];

interface OrderWithHistory extends OrderWithItems {
  order_status_history?: OrderStatusHistory[];
}

export function AccountOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, order_items(*), order_status_history(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      const rows = (data ?? []) as unknown as OrderWithHistory[];
      rows.forEach((row) => {
        row.order_status_history?.sort(
          (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
        );
      });
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleCancelOrder(orderId: string) {
    setCancellingId(orderId);
    setCancelError(null);
    try {
      const { data, error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }> })
        .rpc('update_order_status', {
          p_order_id: orderId,
          p_new_status: 'cancelled',
        });

      if (rpcError) {
        setCancelError('Failed to cancel order. Please try again.');
        setCancellingId(null);
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        setCancelError(result.error ?? 'Failed to cancel order.');
        setCancellingId(null);
        return;
      }

      await loadOrders();
    } catch {
      setCancelError('An error occurred while cancelling the order.');
    } finally {
      setCancellingId(null);
    }
  }

  if (isLoading) return <LoadingSection label="Loading orders" />;
  if (error) return <ErrorState message={error} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="When you place an order, it will appear here."
        action={{ label: 'Start Shopping', href: '/products' }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {cancelError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {cancelError}
        </div>
      )}
      {orders.map((order) => {
        const isExpanded = expandedId === order.id;
        const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
        const canCancel = cancellableStatuses.includes(order.status);
        const history = order.order_status_history ?? [];
        const shippingAddr = order.shipping_address as { full_name?: string; phone?: string; address?: string; city?: string } | null;
        return (
          <div key={order.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('rounded-full px-3 py-1 text-xs font-medium uppercase', statusColors[order.status] ?? 'bg-muted text-muted-foreground')}>
                  {statusLabels[order.status] ?? order.status}
                </span>
                <span className="font-bold text-foreground">{formatPrice(order.total)}</span>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-5 animate-in">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Items + totals */}
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Items</h4>
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-foreground">{item.product_name}</span>
                            {item.product_sku && <span className="ml-2 text-xs text-muted-foreground">SKU: {item.product_sku}</span>}
                            <span className="ml-2 text-muted-foreground">× {item.quantity}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">{formatPrice(item.line_total)}</p>
                            <p className="text-xs text-muted-foreground">{formatPrice(item.unit_price)} each</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="font-medium text-foreground">
                          {order.shipping_cost === 0 ? 'Free' : formatPrice(order.shipping_cost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">COD Fee</span>
                        <span className="font-medium text-foreground">{formatPrice(order.tax_amount)}</span>
                      </div>
                      {order.notes && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Notes</span>
                          <span className="max-w-xs text-right text-foreground">{order.notes}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-border pt-1.5">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-display text-lg font-bold text-foreground">{formatPrice(order.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Shipping address + status timeline + cancel */}
                  <div className="space-y-5">
                    {shippingAddr && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shipping Address</h4>
                        <div className="flex items-start gap-2 text-sm text-foreground">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{shippingAddr.full_name ?? '—'}</p>
                            <p className="text-muted-foreground">{shippingAddr.address ?? '—'}</p>
                            <p className="text-muted-foreground">{shippingAddr.city ?? '—'}</p>
                            {shippingAddr.phone && <p className="text-muted-foreground">{shippingAddr.phone}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status timeline */}
                    {history.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Timeline</h4>
                        <div className="space-y-2">
                          {history.map((h) => (
                            <div key={h.id} className="flex items-start gap-3 text-sm">
                              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-foreground">
                                  {h.old_status ? (
                                    <span className="capitalize">{statusLabels[h.old_status] ?? h.old_status}</span>
                                  ) : (
                                    <span className="text-muted-foreground">Order placed</span>
                                  )}
                                  {' → '}
                                  <span className="font-medium capitalize">{statusLabels[h.new_status] ?? h.new_status}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cancel button */}
                    {canCancel && (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancellingId === order.id}
                          onClick={() => handleCancelOrder(order.id)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {cancellingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span className="ml-2">Cancel Order</span>
                        </Button>
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
  );
}
