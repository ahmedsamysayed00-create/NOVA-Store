import { cn } from '@/lib/utils';

const variantStyles = {
  sale: 'bg-destructive text-destructive-foreground',
  new: 'bg-primary text-primary-foreground',
  bestseller: 'bg-warning text-warning-foreground',
  featured: 'bg-foreground text-background',
  'out-of-stock': 'bg-muted text-muted-foreground',
};

const labelMap = {
  sale: 'Sale',
  new: 'New',
  bestseller: 'Best Seller',
  featured: 'Featured',
  'out-of-stock': 'Out of Stock',
};

export type BadgeVariant = keyof typeof variantStyles;

interface ProductBadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export function ProductBadge({ variant, label, className }: ProductBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
    >
      {label ?? labelMap[variant]}
    </span>
  );
}
