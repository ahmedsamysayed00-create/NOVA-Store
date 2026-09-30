import { cn } from '@/lib/utils';

interface ProductPriceProps {
  price: number;
  compareAtPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { current: 'text-sm', original: 'text-xs' },
  md: { current: 'text-base', original: 'text-sm' },
  lg: { current: 'text-2xl', original: 'text-base' },
};

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function ProductPrice({ price, compareAtPrice, size = 'md', className }: ProductPriceProps) {
  const hasDiscount = compareAtPrice && compareAtPrice > price;
  const styles = sizeMap[size];

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('font-bold text-foreground', styles.current)}>
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <span className={cn('text-muted-foreground line-through', styles.original)}>
          {formatPrice(compareAtPrice)}
        </span>
      )}
    </div>
  );
}
