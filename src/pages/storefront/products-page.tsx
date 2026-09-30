import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { ProductGrid } from '@/components/common/product-grid';
import { ProductGridSkeleton } from '@/components/common/product-skeleton';
import { EmptyProductsState } from '@/components/common/empty-products-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchFilteredProducts, type ProductFilter } from '@/lib/product-service';
import { supabase } from '@/lib/supabase';
import type { ProductCardData, Category } from '@/types/database';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'name';

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('category');
  const filter = searchParams.get('filter');
  const searchQuery = searchParams.get('search');

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const productFilter: ProductFilter = {
          categorySlug: categorySlug ?? null,
          searchQuery: searchQuery ?? null,
          minPrice: minPrice ? parseFloat(minPrice) : null,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
          inStockOnly,
          sortBy,
        };

        if (filter === 'offers') {
          productFilter.searchQuery = null;
        }

        const [prodData, catData] = await Promise.all([
          fetchFilteredProducts(productFilter, 24),
          supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
        ]);

        if (catData.error) throw catData.error;

        let filtered = prodData;
        if (filter === 'offers') filtered = filtered.filter((p) => p.is_on_offer);
        if (filter === 'featured') filtered = filtered.filter((p) => p.is_featured);
        if (filter === 'bestsellers') filtered = filtered.filter((p) => p.is_bestseller);

        setProducts(filtered);
        setCategories(catData.data as Category[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [categorySlug, filter, searchQuery, sortBy, minPrice, maxPrice, inStockOnly]);

  const pageTitle = searchQuery
    ? `Search: "${searchQuery}"`
    : categorySlug
      ? categories.find((c) => c.slug === categorySlug)?.name ?? 'Products'
      : filter === 'offers'
        ? 'Special Offers'
        : filter === 'featured'
          ? 'Featured Products'
          : filter === 'bestsellers'
            ? 'Best Sellers'
            : 'All Products';

  function clearFilters() {
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSortBy('newest');
    setSearchParams({});
  }

  const hasActiveFilters = !!minPrice || !!maxPrice || inStockOnly || sortBy !== 'newest';

  useEffect(() => {
    document.title = `${pageTitle} — NOVA Store`;
  }, [pageTitle]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{pageTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? 'Loading products…' : `${products.length} product${products.length !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Category:
          </span>
          <button
            onClick={() => setSearchParams(searchQuery ? { search: searchQuery } : {})}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !categorySlug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSearchParams({ category: cat.slug })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                categorySlug === cat.slug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Sort + Filter toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="name">Name: A to Z</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Price + availability filters */}
      {showFilters && (
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 animate-in">
          <div className="space-y-1.5">
            <Label className="text-xs">Min Price</Label>
            <Input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-28"
              min="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max Price</Label>
            <Input
              type="number"
              placeholder="1000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-28"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="inStock"
              checked={inStockOnly}
              onCheckedChange={(checked) => setInStockOnly(checked === true)}
            />
            <Label htmlFor="inStock" className="cursor-pointer text-sm">In stock only</Label>
          </div>
        </div>
      )}

      {/* Products */}
      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : error ? (
        <ErrorState message={error} />
      ) : products.length === 0 ? (
        <EmptyProductsState
          title={searchQuery ? 'No matching products' : 'No products found'}
          description={searchQuery ? 'Try a different search term or adjust your filters.' : undefined}
        />
      ) : (
        <ProductGrid products={products} columns={4} />
      )}
    </div>
  );
}
