import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function Rating({ value, count, size = 'sm', showCount = true, className }: RatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const fullStars = Math.floor(clamped);
  const hasHalf = clamped - fullStars >= 0.25 && clamped - fullStars < 0.75;
  const roundedUp = clamped - fullStars >= 0.75;
  const totalFilled = fullStars + (roundedUp ? 1 : 0);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < totalFilled) {
            return <Star key={i} className={cn(sizeMap[size], 'fill-warning text-warning')} />;
          }
          if (i === fullStars && hasHalf) {
            return <StarHalf key={i} className={cn(sizeMap[size], 'fill-warning text-warning')} />;
          }
          return <Star key={i} className={cn(sizeMap[size], 'text-muted-foreground/40')} />;
        })}
      </div>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          {clamped.toFixed(1)}
          {typeof count === 'number' && ` (${count})`}
        </span>
      )}
    </div>
  );
}
