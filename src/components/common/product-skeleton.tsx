import { cn } from '@/lib/utils';

export function ProductSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-card',
        className
      )}
    >
      <div className="p-3">
        <div className="shimmer aspect-square rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <div className="shimmer h-3 w-20 rounded" />
        <div className="shimmer h-4 w-full rounded" />
        <div className="shimmer h-4 w-2/3 rounded" />
        <div className="mt-2 flex items-center justify-between">
          <div className="shimmer h-5 w-16 rounded" />
          <div className="shimmer h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}
