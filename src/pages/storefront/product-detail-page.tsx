import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Heart, Minus, Plus, ShoppingCart, Truck, Shield, Loader2, Star, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductImage } from '@/components/common/product-image';
import { ProductPrice, formatPrice } from '@/components/common/product-price';
import { Rating } from '@/components/common/rating';
import { ProductBadge } from '@/components/common/product-badge';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { ProductCard } from '@/components/common/product-card';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { useWishlist } from '@/hooks/use-wishlist';
import { useToast } from '@/hooks/use-toast';
import type { ProductWithRelations, ReviewWithProfile, ProductCardData } from '@/types/database';
import { cn } from '@/lib/utils';

type ReviewSubmitResult = { success: boolean; action?: string; review_id?: string; error?: string };

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductWithRelations | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [myReview, setMyReview] = useState<ReviewWithProfile | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<ProductCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [cartError, setCartError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isEditingReview, setIsEditingReview] = useState(false);

  useEffect(() => {
    if (slug) {
      document.title = `${slug} — NOVA Store`;
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const currentSlug = slug;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('products')
          .select('*, category:categories(*), product_images(*)')
          .eq('slug', currentSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (err) throw err;
        if (!data) {
          setProduct(null);
          setIsLoading(false);
          return;
        }

        const productData = data as unknown as ProductWithRelations;
        setProduct(productData);
        setActiveImageIdx(0);
        document.title = `${productData.name} — NOVA Store`;

        // Load reviews + related products in parallel
        const productId = productData.id;
        const [reviewRes, relatedRes] = await Promise.all([
          supabase
            .from('reviews')
            .select('*, profiles:id(full_name, avatar_url)')
            .eq('product_id', productId)
            .eq('is_approved', true)
            .order('created_at', { ascending: false }),
          productData.category_id
            ? supabase
                .from('products')
                .select('id, name, slug, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, brand, rating_avg, rating_count, product_images!inner(url)')
                .eq('category_id', productData.category_id)
                .eq('is_active', true)
                .neq('id', productId)
                .limit(4)
            : Promise.resolve({ data: null, error: null }),
        ]);

        setReviews((reviewRes.data ?? []) as unknown as ReviewWithProfile[]);

        // Format related products
        if (relatedRes.data) {
          const related: ProductCardData[] = (relatedRes.data as unknown as Array<
            ProductCardData & { product_images: Array<{ url: string }> }
          >).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compare_at_price: p.compare_at_price,
            stock: p.stock,
            is_featured: p.is_featured,
            is_bestseller: p.is_bestseller,
            is_on_offer: p.is_on_offer,
            brand: p.brand,
            rating_avg: p.rating_avg,
            rating_count: p.rating_count,
            primary_image: p.product_images?.[0]?.url ?? null,
            category_name: productData.category?.name ?? null,
          }));
          setRelatedProducts(related);
        }

        // Check if current user has purchased this product and has existing review
        if (user) {
          const myReviewRes = await supabase
              .from('reviews')
              .select('*')
              .eq('product_id', productId)
              .eq('user_id', user.id)
              .maybeSingle();

          // More reliable purchase check: join through orders
          const { data: purchaseCheck } = await supabase
            .from('orders')
            .select('id, order_items!inner(product_id)')
            .eq('user_id', user.id)
            .eq('order_items.product_id', productId)
            .limit(1);
          setHasPurchased((purchaseCheck ?? []).length > 0);

          if (myReviewRes.data) {
            setMyReview(myReviewRes.data as unknown as ReviewWithProfile);
            setReviewRating((myReviewRes.data as { rating: number }).rating);
            setReviewTitle((myReviewRes.data as { title: string | null }).title ?? '');
            setReviewBody((myReviewRes.data as { body: string | null }).body ?? '');
          } else {
            setMyReview(null);
            setReviewRating(5);
            setReviewTitle('');
            setReviewBody('');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [slug, user]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${product.slug}` } });
      return;
    }
    setCartError(null);
    setIsAdding(true);
    const { error: err } = await addToCart(product.id, quantity);
    setIsAdding(false);
    if (err) {
      setCartError(err);
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }, [product, isAuthenticated, addToCart, quantity, navigate]);

  const handleWishlist = useCallback(async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${product.slug}` } });
      return;
    }
    await toggleWishlist(product.id);
  }, [product, isAuthenticated, toggleWishlist, navigate]);

  const handleSubmitReview = useCallback(async () => {
    if (!product || !user) return;
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const { data, error: rpcError } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: ReviewSubmitResult | null; error: { message: string } | null }>;
      }).rpc('submit_review', {
        p_product_id: product.id,
        p_rating: reviewRating,
        p_title: reviewTitle.trim() || null,
        p_body: reviewBody.trim() || null,
      });

      if (rpcError) {
        setReviewError('Unable to submit your review. Please try again.');
        setIsSubmittingReview(false);
        return;
      }

      const result = data as ReviewSubmitResult;
      if (!result.success) {
        setReviewError(result.error ?? 'Failed to submit review.');
        setIsSubmittingReview(false);
        return;
      }

      // Reload reviews
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*, profiles:id(full_name, avatar_url)')
        .eq('product_id', product.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      setReviews((reviewData ?? []) as unknown as ReviewWithProfile[]);

      // Reload my review
      const { data: myReviewData } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', product.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setMyReview(myReviewData as unknown as ReviewWithProfile | null);

      // Reload product to get updated rating
      const { data: prodData } = await supabase
        .from('products')
        .select('rating_avg, rating_count')
        .eq('id', product.id)
        .maybeSingle();
      if (prodData) {
        setProduct((prev) => prev ? { ...prev, rating_avg: (prodData as { rating_avg: number }).rating_avg, rating_count: (prodData as { rating_count: number }).rating_count } : prev);
      }

      setShowReviewForm(false);
      setIsEditingReview(false);
      toast({ title: result.action === 'updated' ? 'Review updated' : 'Review posted', description: 'Thank you for your feedback!' });
    } catch {
      setReviewError('An unexpected error occurred.');
    } finally {
      setIsSubmittingReview(false);
    }
  }, [product, user, reviewRating, reviewTitle, reviewBody, toast]);

  const handleDeleteReview = useCallback(async () => {
    if (!myReview || !product || !user) return;
    try {
      const { error: delError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', myReview.id)
        .eq('user_id', user.id);

      if (delError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete review.' });
        return;
      }

      // Reload reviews
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*, profiles:id(full_name, avatar_url)')
        .eq('product_id', product.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      setReviews((reviewData ?? []) as unknown as ReviewWithProfile[]);

      // Reload product rating
      const { data: prodData } = await supabase
        .from('products')
        .select('rating_avg, rating_count')
        .eq('id', product.id)
        .maybeSingle();
      if (prodData) {
        setProduct((prev) => prev ? { ...prev, rating_avg: (prodData as { rating_avg: number }).rating_avg, rating_count: (prodData as { rating_count: number }).rating_count } : prev);
      }

      setMyReview(null);
      setReviewRating(5);
      setReviewTitle('');
      setReviewBody('');
      toast({ title: 'Review deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete review.' });
    }
  }, [myReview, product, user, toast]);

  const startEditReview = useCallback(() => {
    if (!myReview) return;
    setReviewRating(myReview.rating);
    setReviewTitle(myReview.title ?? '');
    setReviewBody(myReview.body ?? '');
    setIsEditingReview(true);
    setShowReviewForm(true);
  }, [myReview]);

  const cancelReviewForm = useCallback(() => {
    setShowReviewForm(false);
    setIsEditingReview(false);
    setReviewError(null);
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewTitle(myReview.title ?? '');
      setReviewBody(myReview.body ?? '');
    } else {
      setReviewRating(5);
      setReviewTitle('');
      setReviewBody('');
    }
  }, [myReview]);

  if (isLoading) return <LoadingSection label="Loading product" />;
  if (error) return <ErrorState message={error} />;
  if (!product)
    return (
      <EmptyState
        title="Product not found"
        description="The product you're looking for doesn't exist or has been removed."
        action={{ label: 'Back to Products', href: '/products' }}
      />
    );

  const isOutOfStock = product.stock <= 0;
  const images = product.product_images ?? [];
  const activeImage = images[activeImageIdx]?.url ?? null;
  const wishlisted = isInWishlist(product.id);

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const totalReviews = reviews.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-8">
      <Link
        to="/products"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          <ProductImage src={activeImage} alt={product.name} aspect="square" className="border border-border" />
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(idx)}
                  className={cn(
                    'overflow-hidden rounded-lg border-2 transition-colors',
                    idx === activeImageIdx ? 'border-primary' : 'border-border hover:border-border/80'
                  )}
                  aria-label={`View image ${idx + 1}`}
                  aria-pressed={idx === activeImageIdx}
                >
                  <ProductImage
                    src={img.url}
                    alt={img.alt_text ?? product.name}
                    aspect="square"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <Link
              to={`/products?category=${product.category.slug}`}
              className="text-xs font-medium uppercase tracking-wider text-primary"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {product.name}
          </h1>
          {product.brand && (
            <p className="mt-1 text-sm text-muted-foreground">by {product.brand}</p>
          )}

          {product.rating_count > 0 && (
            <div className="mt-4">
              <Rating value={product.rating_avg} count={product.rating_count} size="md" />
            </div>
          )}

          <div className="mt-6">
            <ProductPrice
              price={product.price}
              compareAtPrice={product.compare_at_price}
              size="lg"
            />
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {product.short_description ?? product.description ?? 'No description available.'}
          </p>

          {/* Stock status */}
          <div className="mt-6">
            {isOutOfStock ? (
              <ProductBadge variant="out-of-stock" />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <Check className="h-4 w-4" />
                In Stock ({product.stock} available)
              </span>
            )}
          </div>

          {cartError && (
            <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {cartError}
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center rounded-lg border border-border">
              <button
                className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={isOutOfStock}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-semibold text-foreground" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
              <button
                className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                disabled={isOutOfStock}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="lg"
              disabled={isOutOfStock || isAdding}
              onClick={handleAddToCart}
              className="flex-1 font-semibold"
            >
              {isAdding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : added ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              {isOutOfStock ? 'Out of Stock' : added ? 'Added to Cart!' : `Add to Cart — ${formatPrice(product.price * quantity)}`}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={isOutOfStock}
              onClick={handleWishlist}
              className={cn(wishlisted && 'border-destructive/50 text-destructive')}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={cn('h-4 w-4', wishlisted && 'fill-destructive')} />
            </Button>
          </div>

          {/* Trust */}
          <div className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card/50 p-5">
            <div className="flex items-center gap-2.5">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Free shipping over $75</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">2-year warranty</span>
            </div>
          </div>

          {/* Full description */}
          {product.description && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Description</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            </div>
          )}

          {/* Specifications */}
          {(product.brand || product.weight || product.dimensions || product.sku) && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Specifications</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {product.brand && (
                  <div className="flex justify-between border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="font-medium text-foreground">{product.brand}</dd>
                  </div>
                )}
                {product.sku && (
                  <div className="flex justify-between border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">SKU</dt>
                    <dd className="font-medium text-foreground">{product.sku}</dd>
                  </div>
                )}
                {product.weight && (
                  <div className="flex justify-between border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">Weight</dt>
                    <dd className="font-medium text-foreground">{product.weight} kg</dd>
                  </div>
                )}
                {product.dimensions && (
                  <div className="flex justify-between border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd className="font-medium text-foreground">{product.dimensions}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <section className="mt-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Customer Reviews ({totalReviews})
          </h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Rating summary + distribution */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="font-display text-4xl font-bold text-foreground">
                {totalReviews > 0 ? product.rating_avg.toFixed(1) : '—'}
              </p>
              {totalReviews > 0 && (
                <div className="mt-2 flex justify-center">
                  <Rating value={product.rating_avg} showCount={false} size="sm" />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {totalReviews} review{totalReviews !== 1 ? 's' : ''}
              </p>
            </div>

            {totalReviews > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="space-y-2">
                  {ratingDist.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="flex w-12 items-center gap-1 text-muted-foreground">
                        {star} <Star className="h-3 w-3 fill-foreground" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${totalReviews > 0 ? (count / totalReviews) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Write review button */}
            {isAuthenticated && hasPurchased && !myReview && !showReviewForm && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowReviewForm(true)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Write a Review
              </Button>
            )}

            {/* My review card */}
            {myReview && !showReviewForm && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Your Review</p>
                <Rating value={myReview.rating} showCount={false} size="sm" />
                {myReview.title && <p className="mt-2 font-semibold text-foreground">{myReview.title}</p>}
                {myReview.body && <p className="mt-1 text-sm text-muted-foreground">{myReview.body}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={startEditReview}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDeleteReview}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link> to write a review.
                </p>
              </div>
            )}

            {isAuthenticated && !hasPurchased && (
              <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  You can review this product after purchasing it.
                </p>
              </div>
            )}
          </div>

          {/* Review form + list */}
          <div className="space-y-6">
            {/* Review form */}
            {showReviewForm && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-display text-lg font-bold text-foreground">
                  {isEditingReview ? 'Edit Your Review' : 'Write a Review'}
                </h3>
                {reviewError && (
                  <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                    {reviewError}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="review-rating">Rating</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1"
                          aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={cn(
                              'h-7 w-7 transition-colors',
                              star <= reviewRating ? 'fill-primary text-primary' : 'text-muted-foreground'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-title">Title (optional)</Label>
                    <Input
                      id="review-title"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Summarize your experience"
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-body">Review (optional)</Label>
                    <Textarea
                      id="review-body"
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      placeholder="What did you like or dislike? How was the quality?"
                      rows={4}
                      maxLength={2000}
                    />
                    <p className="text-right text-xs text-muted-foreground">{reviewBody.length}/2000</p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleSubmitReview} disabled={isSubmittingReview}>
                      {isSubmittingReview ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting…
                        </>
                      ) : isEditingReview ? 'Update Review' : 'Submit Review'}
                    </Button>
                    <Button variant="outline" onClick={cancelReviewForm}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Review list */}
            {reviews.length === 0 && !showReviewForm ? (
              <EmptyState
                title="No reviews yet"
                description={hasPurchased ? "Be the first to review this product." : "Reviews will appear here after customers share their experiences."}
              />
            ) : (
              <div className="grid gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                          {(review.profiles?.full_name ?? 'A')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {review.profiles?.full_name ?? 'Anonymous'}
                          </p>
                          <Rating value={review.rating} showCount={false} />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.title && (
                      <h4 className="mt-3 font-semibold text-foreground">{review.title}</h4>
                    )}
                    {review.body && (
                      <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-foreground">Related Products</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
