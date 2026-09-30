import { PackageOpen } from 'lucide-react';
import { EmptyState } from './empty-state';

interface EmptyProductsStateProps {
  title?: string;
  description?: string;
}

export function EmptyProductsState({
  title = 'No products found',
  description = 'We couldn\'t find any products matching your criteria. Check back soon as we\'re adding new items regularly.',
}: EmptyProductsStateProps) {
  return (
    <EmptyState
      icon={PackageOpen}
      title={title}
      description={description}
      action={{ label: 'Browse All Products', href: '/products' }}
    />
  );
}
