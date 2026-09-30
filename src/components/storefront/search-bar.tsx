import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { searchProducts, type SearchResult } from '@/lib/product-service';
import { ProductImage } from '@/components/common/product-image';
import { formatPrice } from '@/components/common/product-price';
import { cn } from '@/lib/utils';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const debounce = setTimeout(async () => {
      try {
        const r = await searchProducts(query, 6);
        if (!cancelled) {
          setResults(r);
          setIsOpen(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search products…"
          className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-10 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64 lg:w-80"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {isOpen && (query.trim().length > 0) && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl sm:w-96">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No products found for "{query}"
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    navigate(`/products/${product.slug}`);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted'
                  )}
                >
                  <ProductImage
                    src={product.primary_image}
                    alt={product.name}
                    aspect="square"
                    className="h-12 w-12 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    {product.category_name && (
                      <p className="text-xs text-muted-foreground">{product.category_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                </button>
              ))}
              <button
                onClick={handleSubmit}
                className="w-full border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
              >
                View all results
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
