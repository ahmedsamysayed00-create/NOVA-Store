import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
  aspect?: 'square' | 'video' | 'wide';
}

const aspectMap = {
  square: 'aspect-square',
  video: 'aspect-video',
  wide: 'aspect-[4/3]',
};

export function ProductImage({ src, alt, className, aspect = 'square' }: ProductImageProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-muted', aspectMap[aspect], className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <svg
            className="h-12 w-12 text-muted-foreground/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
          </svg>
        </div>
      )}
    </div>
  );
}
