import { useEffect, useState, useCallback } from 'react';
import { Heart, Loader2, Trash2, ShoppingCart } from 'lucide-react';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { ProductCard } from '@/components/common/product-card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductImage, WishlistItemWithProduct } from '@/types/database';
import type { ProductCardData } from '@/types/database';

export function AccountWishlistPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [items, setItems] = useState<WishlistItemWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('wishlist_items')
        .select('*, product:products(*, product_images(*))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setItems((data ?? []) as unknown as WishlistItemWithProduct[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wishlist');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleRemove = useCallback(async (productId: string) => {
    if (!user) return;
    setRemovingId(productId);
    try {
      const { error: err } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (err) throw err;
      setItems((prev) => prev.filter((item) => item.product_id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item.');
    } finally {
      setRemovingId(null);
    }
  }, [user]);

  const handleAddToCart = useCallback(
    async (productId: string, productName: string) => {
      setAddingId(productId);
      try {
        const { error: addError } = await addToCart(productId, 1);
        if (addError) {
          toast({
            title: 'Could not add to cart',
            description: addError,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Added to cart',
            description: `${productName} is now in your cart.`,
          });
        }
      } finally {
        setAddingId(null);
      }
    },
    [addToCart, toast]
  );

  if (isLoading) return <LoadingSection label="Loading wishlist" />;
  if (error) return <ErrorState message={error} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Save products you love to find them quickly later."
        action={{ label: 'Browse Products', href: '/products' }}
      />
    );
  }

  const products: ProductCardData[] = items.map((item) => {
    const p = item.product as Product & { product_images: ProductImage[] };
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compare_at_price: p.compare_at_price,
      stock: p.stock,
      is_featured: p.is_featured,
      is_bestseller: p.is_bestseller,
      is_on_offer: p.is_on_offer,
      brand: p.brand,
      rating_avg: p.rating_avg,
      rating_count: p.rating_count,
      primary_image: p.product_images?.[0]?.url ?? null,
      category_name: null,
    };
  });

  return (
    <div>
      <h2 className="mb-6 font-display text-lg font-bold text-foreground">
        Wishlist ({items.length})
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const product = products.find((p) => p.id === item.product_id)!;
          const p = item.product as Product & { product_images: ProductImage[] };
          const isInactive = p.is_active === false;
          const outOfStock = p.stock <= 0;
          const unavailable = isInactive || outOfStock;
          const isAdding = addingId === item.product_id;

          return (
            <div key={product.id} className="relative">
              <ProductCard product={product} />

              {/* Remove button */}
              <button
                onClick={() => handleRemove(product.id)}
                disabled={removingId === product.id}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive disabled:opacity-40"
                aria-label="Remove from wishlist"
              >
                {removingId === product.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>

              {/* Unavailable / Out of stock badge */}
              {unavailable && (
                <div className="pointer-events-none absolute inset-0 z-[5] flex items-start justify-center pt-16">
                  <span className="rounded-full bg-foreground/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background">
                    {isInactive ? 'Unavailable' : 'Out of stock'}
                  </span>
                </div>
              )}

              {/* Add to cart */}
              <div className="mt-2">
                <button
                  onClick={() => handleAddToCart(product.id, product.name)}
                  disabled={unavailable || isAdding}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      {unavailable
                        ? isInactive
                          ? 'Unavailable'
                          : 'Out of stock'
                        : 'Add to Cart'}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
