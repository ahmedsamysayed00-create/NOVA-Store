import { useEffect, useState, useCallback } from 'react';
import { Package, Search, Loader2, ArrowUpCircle, ArrowDownCircle, AlertTriangle, XCircle, History } from 'lucide-react';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { LOW_STOCK_THRESHOLD } from '@/types/database';
import type { AdjustInventoryResult, InventoryTransaction } from '@/types/database';

interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  is_active: boolean;
  category_name: string | null;
}

type StockLevel = 'out' | 'low' | 'normal';

function getStockLevel(stock: number): StockLevel {
  if (stock === 0) return 'out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'normal';
}

const stockLevelConfig: Record<StockLevel, { label: string; className: string; icon: typeof AlertTriangle }> = {
  out: { label: 'Out of Stock', className: 'bg-destructive/10 text-destructive', icon: XCircle },
  low: { label: 'Low Stock', className: 'bg-warning/10 text-warning', icon: AlertTriangle },
  normal: { label: 'In Stock', className: 'bg-success/10 text-success', icon: Package },
};

export function AdminInventoryPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | StockLevel>('all');

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<InventoryProduct | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<InventoryProduct | null>(null);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = supabase
        .from('products')
        .select('id, name, sku, stock, is_active, category:categories(name)')
        .order('stock', { ascending: true });

      const { data, error: err } = await query.limit(200);
      if (err) throw err;

      const rows = (data ?? []) as unknown as (InventoryProduct & { category: { name: string } | null })[];
      const mapped: InventoryProduct[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        stock: r.stock,
        is_active: r.is_active,
        category_name: r.category?.name ?? null,
      }));

      let filtered = mapped;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
        );
      }
      if (stockFilter !== 'all') {
        filtered = filtered.filter((p) => getStockLevel(p.stock) === stockFilter);
      }

      setProducts(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, [search, stockFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openAdjust(product: InventoryProduct) {
    setAdjustProduct(product);
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustError(null);
    setAdjustDialogOpen(true);
  }

  async function handleAdjust() {
    if (!adjustProduct) return;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) {
      setAdjustError('Please enter a non-zero whole number.');
      return;
    }
    setAdjusting(true);
    setAdjustError(null);
    try {
      const { data, error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: AdjustInventoryResult | null; error: { message: string } | null }> })
        .rpc('adjust_inventory', {
          p_product_id: adjustProduct.id,
          p_quantity_change: amount,
          p_reason: adjustReason || null,
        });

      if (rpcError) {
        setAdjustError('Failed to adjust inventory. Please try again.');
        setAdjusting(false);
        return;
      }

      const result = data as AdjustInventoryResult;
      if (!result.success) {
        setAdjustError(result.error ?? 'Failed to adjust inventory.');
        setAdjusting(false);
        return;
      }

      setAdjustDialogOpen(false);
      await loadProducts();
    } catch {
      setAdjustError('An error occurred while adjusting inventory.');
    } finally {
      setAdjusting(false);
    }
  }

  async function openHistory(product: InventoryProduct) {
    setHistoryProduct(product);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const { data, error: err } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      setHistory((data ?? []) as InventoryTransaction[]);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  if (isLoading) return <LoadingSection label="Loading inventory" />;
  if (error) return <ErrorState message={error} />;

  const outCount = products.filter((p) => getStockLevel(p.stock) === 'out').length;
  const lowCount = products.filter((p) => getStockLevel(p.stock) === 'low').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 ? 's' : ''}
            {outCount > 0 && <span className="ml-2 text-destructive">· {outCount} out of stock</span>}
            {lowCount > 0 && <span className="ml-2 text-warning">· {lowCount} low stock</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'out', 'low', 'normal'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={stockFilter === f ? 'default' : 'outline'}
              onClick={() => setStockFilter(f)}
            >
              {f === 'all' ? 'All' : stockLevelConfig[f as StockLevel].label}
            </Button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Adjust your search or filter to find products."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Product</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foreground sm:table-cell">SKU</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Stock</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foreground md:table-cell">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const level = getStockLevel(product.stock);
                const config = stockLevelConfig[level];
                return (
                  <tr key={product.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{product.name}</p>
                      {product.category_name && (
                        <p className="text-xs text-muted-foreground">{product.category_name}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {product.sku ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'font-bold',
                        level === 'out' && 'text-destructive',
                        level === 'low' && 'text-warning',
                        level === 'normal' && 'text-foreground'
                      )}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
                        <config.icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openHistory(product)} aria-label={`View history for ${product.name}`}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAdjust(product)} aria-label={`Adjust stock for ${product.name}`}>
                          <ArrowUpCircle className="h-4 w-4 text-success" />
                          <span className="ml-1.5">Adjust</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust inventory dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>
              {adjustProduct && (
                <>Adjusting stock for <strong>{adjustProduct.name}</strong>. Current stock: {adjustProduct.stock}.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setAdjustAmount((prev) => {
                  const n = parseInt(prev, 10);
                  return isNaN(n) ? '10' : String(Math.abs(n));
                })}
                className="flex flex-col items-center gap-1 py-4"
              >
                <ArrowUpCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Restock (+)</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setAdjustAmount((prev) => {
                  const n = parseInt(prev, 10);
                  return isNaN(n) ? '-5' : n > 0 ? String(-n) : prev;
                })}
                className="flex flex-col items-center gap-1 py-4"
              >
                <ArrowDownCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm">Decrease (−)</span>
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjust-amount">Quantity Change</Label>
              <Input
                id="adjust-amount"
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="e.g. 15 or -5"
                aria-invalid={!!adjustError}
              />
              <p className="text-xs text-muted-foreground">
                Positive number to add stock, negative to remove. Stock cannot go below zero.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason (optional)</Label>
              <Input
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Received new shipment, damaged goods"
              />
            </div>

            {adjustError && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {adjustError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} disabled={adjusting}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={adjusting}>
              {adjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory History</DialogTitle>
            <DialogDescription>
              {historyProduct && <>Transaction history for <strong>{historyProduct.name}</strong></>}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No transactions recorded.</p>
            ) : (
              <div className="space-y-2">
                {history.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        tx.quantity_change > 0 ? 'bg-success/10' : 'bg-destructive/10'
                      )}>
                        {tx.quantity_change > 0 ? (
                          <ArrowUpCircle className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">
                          {tx.transaction_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                        {tx.reason && (
                          <p className="text-xs text-muted-foreground">{tx.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-sm font-bold',
                        tx.quantity_change > 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.quantity_before} → {tx.quantity_after}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
