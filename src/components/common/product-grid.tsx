import { ProductCard } from './product-card';
import type { ProductCardData } from '@/types/database';
import { cn } from '@/lib/utils';

interface ProductGridProps {
  products: ProductCardData[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnsMap = {
  2: 'grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

export function ProductGrid({ products, columns = 4, className }: ProductGridProps) {
  return (
    <div className={cn('grid gap-4', columnsMap[columns], className)}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
