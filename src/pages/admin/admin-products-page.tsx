import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Package,
  Search,
  Pencil,
  Trash2,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/components/common/product-price';
import {
  fetchAdminProducts,
  fetchAdminCategories,
  deleteProduct,
  bulkUpdateProductStatus,
} from '@/lib/admin-service';
import { ProductFormDialog } from '@/components/admin/product-form-dialog';
import { ImageManagerDialog } from '@/components/admin/image-manager-dialog';
import type { Product, Category, ProductWithRelations } from '@/types/database';

const PAGE_SIZE = 20;

export function AdminProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('__all');
  const [statusFilter, setStatusFilter] = useState<string>('__all');
  const [sortBy, setSortBy] = useState('created_at');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, productResult] = await Promise.all([
        fetchAdminCategories(),
        fetchAdminProducts({
          search: search || undefined,
          categoryId: categoryFilter !== '__all' ? categoryFilter : undefined,
          isActive: statusFilter === '__active' ? true : statusFilter === '__inactive' ? false : undefined,
          sortBy,
          sortOrder: 'desc',
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);

      setCategories(cats);
      setProducts(productResult.products);
      setTotal(productResult.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, statusFilter, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, sortBy]);

  function handleAdd() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleImages(product: Product) {
    setImageProduct(product);
    setImageOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteProduct(deleteTarget.id);
      if (result.success) {
        toast({
          title: result.action === 'deactivated' ? 'Product deactivated' : 'Product deleted',
          description: result.message,
        });
        setDeleteTarget(null);
        load();
      } else {
        toast({
          title: 'Cannot delete',
          description: result.error ?? 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  async function handleBulk(action: 'activate' | 'deactivate') {
    setBulkAction(action);
    try {
      await bulkUpdateProductStatus([...selectedIds], action === 'activate');
      toast({
        title: action === 'activate' ? 'Products activated' : 'Products deactivated',
        description: `${selectedIds.size} product(s) updated.`,
      });
      setSelectedIds(new Set());
      load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Bulk action failed',
        variant: 'destructive',
      });
    } finally {
      setBulkAction(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isLoading && products.length === 0) return <LoadingSection label="Loading products" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} product{total !== 1 ? 's' : ''} in catalog
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Status</SelectItem>
            <SelectItem value="__active">Active</SelectItem>
            <SelectItem value="__inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="price">Price Low-High</SelectItem>
            <SelectItem value="stock">Stock Low-High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulk('activate')}
            disabled={!!bulkAction}
          >
            {bulkAction === 'activate' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulk('deactivate')}
            disabled={!!bulkAction}
          >
            {bulkAction === 'deactivate' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Deactivate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="No products match your filters. Try adjusting your search or add a new product."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={selectedIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Price</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Stock</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Flags</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.sku ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.category?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        product.stock <= 10
                          ? 'font-semibold text-warning'
                          : 'text-muted-foreground'
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      {product.is_featured && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary" title="Featured">
                          F
                        </span>
                      )}
                      {product.is_bestseller && (
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent-foreground" title="Best Seller">
                          B
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleImages(product)}
                        title="Manage images"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(product)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(product)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        categories={categories}
        onSaved={load}
      />

      <ImageManagerDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        product={imageProduct}
        onChanged={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                  <br />
                  If this product has been ordered before, it will be deactivated instead to
                  preserve historical order data. Otherwise, it will be permanently deleted
                  along with its images, cart items, wishlist entries, and reviews.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
