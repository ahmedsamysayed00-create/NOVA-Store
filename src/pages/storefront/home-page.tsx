import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Truck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/common/section-heading';
import { ProductGridSkeleton } from '@/components/common/product-skeleton';
import { ProductGrid } from '@/components/common/product-grid';
import { EmptyProductsState } from '@/components/common/empty-products-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { supabase } from '@/lib/supabase';
import type { ProductCardData, Category } from '@/types/database';

const heroImage =
  'https://images.pexels.com/photos/5944189/pexels-photo-5944189.jpeg?auto=compress&cs=tinysrgb&w=1600';

const trustBadges = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders over $75' },
  { icon: Shield, title: '2-Year Warranty', desc: 'On all products' },
  { icon: Zap, title: 'Fast Delivery', desc: 'Ships in 24 hours' },
];

export function HomePage() {
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [bestsellers, setBestsellers] = useState<ProductCardData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'NOVA Store — Upgrade Your Setup | Premium Tech Accessories';
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [featuredRes, bestsellerRes, catRes] = await Promise.all([
          supabase
            .from('products')
            .select(
              'id, name, slug, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, brand, rating_avg, rating_count'
            )
            .eq('is_active', true)
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('products')
            .select(
              'id, name, slug, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, brand, rating_avg, rating_count'
            )
            .eq('is_active', true)
            .eq('is_bestseller', true)
            .order('rating_count', { ascending: false })
            .limit(4),
          supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(6),
        ]);

        if (featuredRes.error) throw featuredRes.error;
        if (bestsellerRes.error) throw bestsellerRes.error;
        if (catRes.error) throw catRes.error;

        setFeatured(featuredRes.data as ProductCardData[]);
        setBestsellers(bestsellerRes.data as ProductCardData[]);
        setCategories(catRes.data as Category[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[600px] items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Premium tech accessories"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 lg:px-8">
          <div className="max-w-2xl animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Premium Tech Accessories
              </span>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl">
              Upgrade Your Setup.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Discover premium mechanical keyboards, precision mice, immersive headsets, and
              essential accessories — engineered for performance.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="font-semibold">
                <Link to="/products">
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products?category=keyboards">Explore Keyboards</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {trustBadges.map((badge) => (
              <div key={badge.title} className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <badge.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-foreground">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 lg:px-8">
        <SectionHeading
          title="Shop by Category"
          subtitle="Find exactly what you need"
          actionLabel="All Categories"
          actionHref="/products"
        />
        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
          ) : error ? (
            <ErrorState message={error} />
          ) : categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Categories will appear here once they are added to the catalog."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="group relative flex h-48 items-end overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50"
                >
                  {cat.image_url && (
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-60"
                    />
                  )}
                  <div className="relative w-full p-6">
                    <h3 className="font-display text-lg font-bold text-foreground">{cat.name}</h3>
                    {cat.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {cat.description}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Shop Now
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-8">
        <SectionHeading
          title="Featured Products"
          subtitle="Handpicked gear we think you'll love"
          actionLabel="View All"
          actionHref="/products"
        />
        <div className="mt-8">
          {isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : error ? (
            <ErrorState message={error} />
          ) : featured.length === 0 ? (
            <EmptyProductsState title="No featured products yet" />
          ) : (
            <ProductGrid products={featured} columns={4} />
          )}
        </div>
      </section>

      {/* Best Sellers */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-8">
        <SectionHeading
          title="Best Sellers"
          subtitle="Our most popular products"
          actionLabel="View All"
          actionHref="/products"
        />
        <div className="mt-8">
          {isLoading ? (
            <ProductGridSkeleton count={4} />
          ) : error ? (
            <ErrorState message={error} />
          ) : bestsellers.length === 0 ? (
            <EmptyProductsState title="No best sellers yet" />
          ) : (
            <ProductGrid products={bestsellers} columns={4} />
          )}
        </div>
      </section>

      {/* Offers banner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-12 text-center">
          <div className="gradient-border absolute inset-0 rounded-2xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Special Offers
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Save big on selected tech accessories. Limited time only.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/products?filter=offers">
                Shop Offers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Reviews teaser */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8">
        <SectionHeading title="What Customers Say" subtitle="Real reviews from real customers" />
        <div className="mt-8">
          <EmptyState
            title="No reviews yet"
            description="Customer reviews will appear here once products have been purchased and reviewed."
          />
        </div>
      </section>
    </div>
  );
}
