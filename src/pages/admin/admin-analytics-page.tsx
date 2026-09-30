import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatPrice } from '@/components/common/product-price';
import {
  fetchSalesOverTime,
  fetchTopProducts,
  fetchLowStockProducts,
} from '@/lib/admin-service';
import type { SalesDataPoint, TopProductRow, LowStockProduct } from '@/types/database';
import { LOW_STOCK_THRESHOLD } from '@/types/database';

type Period = '7' | '30' | '90';

export function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30');
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [sales, top, stock] = await Promise.all([
          fetchSalesOverTime(parseInt(period)),
          fetchTopProducts(10),
          fetchLowStockProducts(LOW_STOCK_THRESHOLD),
        ]);
        setSalesData(sales);
        setTopProducts(top);
        setLowStock(stock);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [period]);

  if (isLoading) return <LoadingSection label="Loading analytics" />;
  if (error) return <ErrorState message={error} />;

  const totalRevenue = salesData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalOrders = salesData.reduce((sum, d) => sum + d.order_count, 0);
  const hasSalesData = salesData.some((d) => Number(d.revenue) > 0 || d.order_count > 0);

  const chartData = salesData.map((d) => ({
    date: d.date.slice(5),
    revenue: Number(d.revenue),
    orders: d.order_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sales and performance insights</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">
                {formatPrice(totalRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">Revenue ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Orders ({period}d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">{lowStock.length}</p>
              <p className="text-xs text-muted-foreground">Low stock items</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasSalesData ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <BarChart3 className="h-10 w-10" />
              <p className="text-sm">No sales data for this period yet.</p>
              <p className="text-xs">Orders will appear here once your store starts receiving traffic.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                  interval={period === '90' ? 6 : period === '30' ? 2 : 0}
                />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [formatPrice(value), 'Revenue'];
                    return [value, 'Orders'];
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Top Products by Units Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Package className="h-8 w-8" />
                <p className="text-sm">No sales data yet.</p>
                <p className="text-xs">Top products will appear here once orders are placed.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((product, index) => (
                  <div
                    key={product.product_id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.units_sold} units sold
                        </p>
                      </div>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatPrice(product.revenue)}
                    </span>
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
              Low Stock Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8" />
                <p className="text-sm">All products are well stocked.</p>
                <p className="text-xs">Threshold: {LOW_STOCK_THRESHOLD} units or fewer.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStock.map((product) => (
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
