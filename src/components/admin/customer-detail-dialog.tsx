import { useState, useEffect } from 'react';
import { Loader2, Mail, Phone, Calendar, ShoppingCart, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fetchCustomerDetail } from '@/lib/admin-service';
import { formatPrice } from '@/components/common/product-price';
import type { Profile, OrderWithItems } from '@/types/database';

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
}

export function CustomerDetailDialog({
  open,
  onOpenChange,
  customerId,
}: CustomerDetailDialogProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      setIsLoading(true);
      fetchCustomerDetail(customerId)
        .then(({ profile, orders }) => {
          setProfile(profile);
          setOrders(orders);
        })
        .catch(() => {
          setProfile(null);
          setOrders([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, customerId]);

  const totalSpent = orders
    .filter((o) => !['cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {profile.full_name ?? 'Unknown'}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {profile.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Joined {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                  {profile.role}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs">Total Orders</span>
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {orders.length}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Total Spent</span>
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {formatPrice(totalSpent)}
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-foreground">Order History</h4>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()} —{' '}
                          {order.order_items.length} item
                          {order.order_items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            order.status === 'delivered'
                              ? 'default'
                              : order.status === 'cancelled'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {order.status}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Customer not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
