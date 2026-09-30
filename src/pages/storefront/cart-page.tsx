import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingSection } from '@/components/common/loading-screen';
import { ProductImage } from '@/components/common/product-image';
import { formatPrice } from '@/components/common/product-price';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';

export function CartPage() {
  const { items, summary, isLoading, updateQuantity, removeFromCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground sm:text-4xl">Shopping Cart</h1>
        <EmptyState
          icon={ShoppingCart}
          title="Sign in to view your cart"
          description="Your cart is saved to your account. Sign in to continue shopping."
          action={{ label: 'Sign In', href: '/login' }}
        />
      </div>
    );
  }

  if (isLoading) return <LoadingSection label="Loading cart" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground sm:text-4xl">Shopping Cart</h1>
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse our catalog and add some products to your cart."
          action={{ label: 'Start Shopping', href: '/products' }}
        />
      </div>
    );
  }

  async function handleQtyChange(productId: string, newQty: number, maxStock: number) {
    if (newQty < 1) return;
    if (newQty > maxStock) return;
    setUpdatingId(productId);
    await updateQuantity(productId, newQty);
    setUpdatingId(null);
  }

  async function handleRemove(productId: string) {
    setUpdatingId(productId);
    await removeFromCart(productId);
    setUpdatingId(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-foreground sm:text-4xl">Shopping Cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => {
            const product = item.product;
            const isUpdating = updatingId === product.id;
            const outOfStock = product.stock <= 0;
            const maxQty = Math.max(1, product.stock);

            return (
              <div key={item.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                <Link to={`/products/${product.slug}`} className="shrink-0">
                  <ProductImage
                    src={product.product_images?.[0]?.url ?? null}
                    alt={product.name}
                    aspect="square"
                    className="h-24 w-24"
                  />
                </Link>

                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/products/${product.slug}`}
                      className="font-display text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    <button
                      onClick={() => handleRemove(product.id)}
                      disabled={isUpdating}
                      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {outOfStock && (
                    <span className="mt-1 text-xs font-medium text-destructive">Out of stock</span>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-lg border border-border">
                      <button
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                        onClick={() => handleQtyChange(product.id, item.quantity - 1, maxQty)}
                        disabled={isUpdating || item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="w-10 text-center text-sm font-semibold text-foreground">{item.quantity}</span>
                      <button
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                        onClick={() => handleQtyChange(product.id, item.quantity + 1, maxQty)}
                        disabled={isUpdating || item.quantity >= maxQty}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(product.price * item.quantity)}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(product.price)} each</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Order Summary</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{formatPrice(summary?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium text-foreground">
                  {(summary?.shipping_cost ?? 0) === 0 ? 'Free' : formatPrice(summary?.shipping_cost ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">COD Fee</span>
                <span className="font-medium text-foreground">{formatPrice(summary?.cod_fee ?? 0)}</span>
              </div>
              <div className="border-t border-border pt-2.5">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-display text-xl font-bold text-foreground">
                    {formatPrice(summary?.total ?? 0)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={() => navigate('/checkout')}
            >
              Proceed to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" className="mt-2 w-full" asChild>
              <Link to="/products">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
