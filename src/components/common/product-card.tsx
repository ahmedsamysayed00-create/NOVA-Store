import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { ProductImage } from './product-image';
import { ProductPrice } from './product-price';
import { Rating } from './rating';
import { ProductBadge } from './product-badge';
import type { ProductCardData } from '@/types/database';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: ProductCardData;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <Link
      to={`/products/${product.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-border/80 hover:shadow-lg hover:shadow-primary/5',
        className
      )}
    >
      <div className="relative p-3">
        <ProductImage src={product.primary_image} alt={product.name} aspect="square" />
        <div className="absolute left-5 top-5 flex flex-col gap-1.5">
          {isOutOfStock && <ProductBadge variant="out-of-stock" />}
          {hasDiscount && !isOutOfStock && <ProductBadge variant="sale" />}
          {product.is_bestseller && !isOutOfStock && <ProductBadge variant="bestseller" />}
          {product.is_featured && !isOutOfStock && !product.is_bestseller && (
            <ProductBadge variant="featured" />
          )}
        </div>
        <button
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-all hover:text-destructive group-hover:opacity-100"
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        {product.category_name && (
          <span className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {product.category_name}
          </span>
        )}
        <h3 className="mb-1.5 line-clamp-2 font-display text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {product.name}
        </h3>
        {product.rating_count > 0 && (
          <Rating value={product.rating_avg} count={product.rating_count} className="mb-2" />
        )}
        <div className="mt-auto flex items-center justify-between">
          <ProductPrice price={product.price} compareAtPrice={product.compare_at_price} size="md" />
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground',
              isOutOfStock && 'pointer-events-none opacity-40'
            )}
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
