import { supabase } from '@/lib/supabase';
import type {
  Product,
  ProductInsert,
  ProductUpdate,
  Category,
  CategoryInsert,
  CategoryUpdate,
  ProductImage,
  ProductImageInsert,
  AdminDashboardStats,
  SalesDataPoint,
  TopProductRow,
  CustomerOverviewRow,
  SafeDeleteResult,
  OrderWithItems,
  LowStockProduct,
  RecentOrder,
} from '@/types/database';

// ============================================================
// Products
// ============================================================

export async function fetchAdminProducts(filters?: {
  search?: string;
  categoryId?: string | null;
  isActive?: boolean | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  const {
    search,
    categoryId,
    isActive,
    sortBy = 'created_at',
    sortOrder = 'desc',
    page = 1,
    pageSize = 20,
  } = filters ?? {};

  let query = supabase
    .from('products')
    .select('*, category:categories(*)', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' });

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,slug.ilike.%${search}%`);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  if (isActive !== null && isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { products: data ?? [], total: count ?? 0 };
}

export async function fetchProductForAdmin(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProduct(input: ProductInsert): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Product;
}

export async function updateProduct(id: string, input: ProductUpdate): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Product;
}

export async function deleteProduct(id: string): Promise<SafeDeleteResult> {
  const { data, error } = await supabase.rpc('safe_delete_product', {
    p_product_id: id,
  } as never);
  if (error) throw error;
  return data as unknown as SafeDeleteResult;
}

export async function bulkUpdateProductStatus(ids: string[], isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive } as never)
    .in('id', ids);
  if (error) throw error;
}

// ============================================================
// Categories
// ============================================================

export async function fetchAdminCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as unknown as Category[]) ?? [];
}

export async function createCategory(input: CategoryInsert): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Category;
}

export async function updateCategory(id: string, input: CategoryUpdate): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(input as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Category;
}

export async function deleteCategory(id: string): Promise<SafeDeleteResult> {
  const { data, error } = await supabase.rpc('safe_delete_category', {
    p_category_id: id,
  } as never);
  if (error) throw error;
  return data as unknown as SafeDeleteResult;
}

export async function checkCategoryCycle(
  categoryId: string,
  newParentId: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_category_cycle', {
    p_category_id: categoryId,
    p_new_parent_id: newParentId,
  } as never);
  if (error) throw error;
  return data as unknown as boolean;
}

export async function fetchCategoryProductCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId);
  if (error) throw error;
  return count ?? 0;
}

// ============================================================
// Product Images
// ============================================================

export async function fetchProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function uploadProductImage(
  file: File,
  productId: string,
  sortOrder: number,
): Promise<ProductImage> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  const insert: ProductImageInsert = {
    product_id: productId,
    url: urlData.publicUrl,
    sort_order: sortOrder,
  };

  const { data, error: dbError } = await supabase
    .from('product_images')
    .insert(insert as never)
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from('product-images').remove([fileName]);
    throw dbError;
  }

  return data;
}

export async function deleteProductImage(image: ProductImage): Promise<void> {
  const filePath = extractStoragePath(image.url);
  const { error: dbError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', image.id);
  if (dbError) throw dbError;

  if (filePath) {
    await supabase.storage.from('product-images').remove([filePath]);
  }
}

export async function updateImageSortOrder(
  imageId: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('product_images')
    .update({ sort_order: sortOrder } as never)
    .eq('id', imageId);
  if (error) throw error;
}

function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/product-images\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ============================================================
// Customers
// ============================================================

export async function fetchCustomers(): Promise<CustomerOverviewRow[]> {
  const { data, error } = await supabase.rpc('get_customer_overview', {} as never);
  if (error) throw error;
  return (data as unknown as CustomerOverviewRow[]) ?? [];
}

export async function fetchCustomerDetail(customerId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false });
  if (ordersError) throw ordersError;

  return {
    profile,
    orders: (orders as unknown as OrderWithItems[]) ?? [],
  };
}

// ============================================================
// Analytics
// ============================================================

export async function fetchDashboardStats(): Promise<AdminDashboardStats> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {} as never);
  if (error) throw error;
  return data as unknown as AdminDashboardStats;
}

export async function fetchSalesOverTime(days: number): Promise<SalesDataPoint[]> {
  const { data, error } = await supabase.rpc('get_sales_over_time', { p_days: days } as never);
  if (error) throw error;
  return (data as unknown as SalesDataPoint[]) ?? [];
}

export async function fetchTopProducts(limit: number): Promise<TopProductRow[]> {
  const { data, error } = await supabase.rpc('get_top_products', { p_limit: limit } as never);
  if (error) throw error;
  return (data as unknown as TopProductRow[]) ?? [];
}

export async function fetchLowStockProducts(threshold: number = 10): Promise<LowStockProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, stock, sku, is_active')
    .lte('stock', threshold)
    .order('stock', { ascending: true });
  if (error) throw error;
  return (data as unknown as LowStockProduct[]) ?? [];
}

export async function fetchRecentOrders(limit: number = 5): Promise<RecentOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at, profiles!inner(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as RecentOrder[]) ?? [];
}
