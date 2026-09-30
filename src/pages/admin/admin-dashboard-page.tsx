import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { formatPrice } from '@/components/common/product-price';
import { Badge } from '@/components/ui/badge';
import {
  fetchDashboardStats,
  fetchRecentOrders,
  fetchLowStockProducts,
} from '@/lib/admin-service';
import type { AdminDashboardStats, LowStockProduct, RecentOrder } from '@/types/database';
import { LOW_STOCK_THRESHOLD } from '@/types/database';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, orders, stock] = await Promise.all([
          fetchDashboardStats(),
          fetchRecentOrders(5),
          fetchLowStockProducts(LOW_STOCK_THRESHOLD),
        ]);
        setStats(s);
        setRecentOrders(orders);
        setLowStock(stock);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) return <LoadingSection label="Loading dashboard" />;
  if (error) return <ErrorState message={error} />;
  if (!stats) return null;

  const cards = [
    {
      label: 'Total Revenue',
      value: formatPrice(stats.total_revenue),
      icon: DollarSign,
      sub: 'Excludes cancelled & refunded',
    },
    {
      label: 'Total Orders',
      value: stats.total_orders,
      icon: ShoppingCart,
      sub: `${stats.pending_orders_count} pending`,
    },
    {
      label: 'Customers',
      value: stats.total_customers,
      icon: Users,
      sub: 'Registered customers',
    },
    {
      label: 'Products',
      value: stats.total_products,
      icon: Package,
      sub: `${stats.low_stock_count} low stock`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your store</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground/70">{card.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.profiles?.full_name ?? order.profiles?.email ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{order.status}</Badge>
                      <span className="font-medium text-foreground">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All products are well stocked (threshold: {LOW_STOCK_THRESHOLD} units).
              </p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku ?? '—'}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.stock === 0
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {product.stock} left
                    </span>
                  </div>
                ))}
                {lowStock.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    + {lowStock.length - 5} more low-stock product(s)
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
