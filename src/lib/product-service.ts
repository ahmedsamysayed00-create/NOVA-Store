import { supabase } from '@/lib/supabase';
import type { ProductCardData } from '@/types/database';

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_featured: boolean;
  is_bestseller: boolean;
  is_on_offer: boolean;
  brand: string | null;
  rating_avg: number;
  rating_count: number;
  primary_image: string | null;
  category_name: string | null;
}

export async function searchProducts(
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const searchTerm = query.trim();

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, slug, price, compare_at_price, stock,
      is_featured, is_bestseller, is_on_offer, brand,
      rating_avg, rating_count,
      category:categories(name),
      product_images(url)`
    )
    .eq('is_active', true)
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`)
    .order('rating_count', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    stock: number;
    is_featured: boolean;
    is_bestseller: boolean;
    is_on_offer: boolean;
    brand: string | null;
    rating_avg: number;
    rating_count: number;
    category: { name: string } | null;
    product_images: { url: string }[];
  }>).map((p) => ({
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
    category_name: p.category?.name ?? null,
  })) as SearchResult[];
}

export type ProductFilter = {
  categorySlug?: string | null;
  searchQuery?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStockOnly?: boolean;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'name';
};

export async function fetchFilteredProducts(
  filter: ProductFilter,
  limit = 24
): Promise<ProductCardData[]> {
  let query = supabase
    .from('products')
    .select(
      `id, name, slug, price, compare_at_price, stock,
      is_featured, is_bestseller, is_on_offer, brand,
      rating_avg, rating_count,
      category:categories(name),
      product_images(url)`
    )
    .eq('is_active', true);

  if (filter.categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filter.categorySlug)
      .maybeSingle();
    if (cat) {
      query = query.eq('category_id', (cat as { id: string }).id);
    }
  }

  if (filter.searchQuery) {
    const term = filter.searchQuery.trim();
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%`);
  }

  if (filter.minPrice != null) {
    query = query.gte('price', filter.minPrice);
  }
  if (filter.maxPrice != null) {
    query = query.lte('price', filter.maxPrice);
  }

  if (filter.inStockOnly) {
    query = query.gt('stock', 0);
  }

  switch (filter.sortBy) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'rating':
      query = query.order('rating_avg', { ascending: false });
      break;
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    stock: number;
    is_featured: boolean;
    is_bestseller: boolean;
    is_on_offer: boolean;
    brand: string | null;
    rating_avg: number;
    rating_count: number;
    category: { name: string } | null;
    product_images: { url: string }[];
  }>).map((p) => ({
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
    category_name: p.category?.name ?? null,
  })) as ProductCardData[];
}
