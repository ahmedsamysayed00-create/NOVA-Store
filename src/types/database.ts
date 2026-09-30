// ============================================================
// NOVA Store — Database Types
// Typed interface mirroring the Supabase PostgreSQL schema.
// ============================================================

export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type InventoryTransactionType = 'order' | 'restock' | 'adjustment' | 'cancellation';

// ---- Row types ----

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  stock: number;
  is_featured: boolean;
  is_bestseller: boolean;
  is_on_offer: boolean;
  is_active: boolean;
  brand: string | null;
  weight: number | null;
  dimensions: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  first_name: string;
  last_name: string;
  company: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  total: number;
  shipping_address_id: string | null;
  shipping_address: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ShippingConfig {
  id: number;
  flat_rate_fee: number;
  free_shipping_threshold: number;
  cod_fee: number;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string;
  changed_at: string;
  note: string | null;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  transaction_type: InventoryTransactionType;
  reference_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

// ---- Insert types ----

export type ProfileInsert = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: UserRole;
  avatar_url?: string | null;
  phone?: string | null;
};

export type CategoryInsert = {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type ProductInsert = {
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  sku?: string | null;
  price: number;
  compare_at_price?: number | null;
  cost?: number | null;
  stock?: number;
  is_featured?: boolean;
  is_bestseller?: boolean;
  is_on_offer?: boolean;
  is_active?: boolean;
  brand?: string | null;
  weight?: number | null;
  dimensions?: string | null;
};

export type ProductImageInsert = {
  product_id: string;
  url: string;
  alt_text?: string | null;
  sort_order?: number;
};

export type AddressInsert = {
  user_id?: string;
  label?: string | null;
  first_name: string;
  last_name: string;
  company?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  phone?: string | null;
  is_default?: boolean;
};

export type OrderInsert = {
  user_id?: string;
  order_number: string;
  status?: OrderStatus;
  subtotal: number;
  shipping_cost?: number;
  tax_amount?: number;
  total: number;
  shipping_address_id?: string | null;
  notes?: string | null;
};

export type OrderItemInsert = {
  order_id: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type WishlistItemInsert = {
  user_id?: string;
  product_id: string;
};

export type CartItemInsert = {
  user_id?: string;
  product_id: string;
  quantity?: number;
};

export type CartItemUpdate = {
  quantity: number;
};

export type ReviewInsert = {
  product_id: string;
  user_id?: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  is_approved?: boolean;
};

// ---- Update types ----

export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id' | 'email'>> & {
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
};

export type CategoryUpdate = Partial<CategoryInsert>;

export type ProductUpdate = Partial<ProductInsert>;

export type AddressUpdate = Partial<AddressInsert>;

export type OrderUpdate = {
  status?: OrderStatus;
  shipping_address_id?: string | null;
  notes?: string | null;
};

export type ReviewUpdate = {
  rating?: number;
  title?: string | null;
  body?: string | null;
};

// ---- Composite / joined types ----

export type ProductWithRelations = Product & {
  category: Category | null;
  product_images: ProductImage[];
};

export type ProductCardData = Pick<
  Product,
  'id' | 'name' | 'slug' | 'price' | 'compare_at_price' | 'stock' | 'is_featured' | 'is_bestseller' | 'is_on_offer' | 'brand' | 'rating_avg' | 'rating_count'
> & {
  primary_image: string | null;
  category_name: string | null;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

export type OrderWithHistory = Order & {
  order_items: OrderItem[];
  order_status_history: OrderStatusHistory[];
};

export type WishlistItemWithProduct = WishlistItem & {
  product: Product & { product_images: ProductImage[] };
};

export type CartItemWithProduct = CartItem & {
  product: Product & { product_images: ProductImage[] };
};

export interface PlaceOrderResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  error?: string;
  detail?: string;
}

export interface CartSummary {
  subtotal: number;
  shipping_cost: number;
  cod_fee: number;
  total: number;
  item_count: number;
}

export type ReviewWithProfile = Review & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
};

// ---- Admin analytics types ----

export interface AdminDashboardStats {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  low_stock_count: number;
  pending_orders_count: number;
  error?: string;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  order_count: number;
}

export interface TopProductRow {
  product_id: string;
  name: string;
  units_sold: number;
  revenue: number;
}

export interface CustomerOverviewRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  order_count: number;
  total_spent: number;
}

export interface SafeDeleteResult {
  success: boolean;
  action?: string;
  message?: string;
  error?: string;
}

export interface AdjustInventoryResult {
  success: boolean;
  product_id?: string;
  product_name?: string;
  stock_before?: number;
  stock_after?: number;
  transaction_type?: InventoryTransactionType;
  error?: string;
}

export interface UpdateOrderStatusResult {
  success: boolean;
  error?: string;
}

export const LOW_STOCK_THRESHOLD = 10;

export interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  stock: number;
  sku: string | null;
  is_active: boolean;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

// ---- Supabase Database type ----

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
        Relationships: [];
      };
      product_images: {
        Row: ProductImage;
        Insert: ProductImageInsert;
        Update: Partial<ProductImageInsert>;
        Relationships: [];
      };
      addresses: {
        Row: Address;
        Insert: AddressInsert;
        Update: AddressUpdate;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: OrderItemInsert;
        Update: Partial<OrderItemInsert>;
        Relationships: [];
      };
      wishlist_items: {
        Row: WishlistItem;
        Insert: WishlistItemInsert;
        Update: Partial<WishlistItemInsert>;
        Relationships: [];
      };
      cart_items: {
        Row: CartItem;
        Insert: CartItemInsert;
        Update: CartItemUpdate;
        Relationships: [];
      };
      shipping_config: {
        Row: ShippingConfig;
        Insert: Partial<ShippingConfig>;
        Update: Partial<ShippingConfig>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: ReviewUpdate;
        Relationships: [];
      };
      order_status_history: {
        Row: OrderStatusHistory;
        Insert: Partial<OrderStatusHistory>;
        Update: never;
        Relationships: [];
      };
      inventory_transactions: {
        Row: InventoryTransaction;
        Insert: Partial<InventoryTransaction>;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, unknown>;
        Returns: boolean;
      };
      place_order: {
        Args: Record<string, unknown>;
        Returns: PlaceOrderResult;
      };
      get_cart_summary: {
        Args: Record<string, unknown>;
        Returns: CartSummary;
      };
      update_order_status: {
        Args: Record<string, unknown>;
        Returns: UpdateOrderStatusResult;
      };
      adjust_inventory: {
        Args: Record<string, unknown>;
        Returns: AdjustInventoryResult;
      };
      get_admin_dashboard_stats: {
        Args: Record<string, unknown>;
        Returns: AdminDashboardStats;
      };
      get_sales_over_time: {
        Args: Record<string, unknown>;
        Returns: SalesDataPoint[];
      };
      get_top_products: {
        Args: Record<string, unknown>;
        Returns: TopProductRow[];
      };
      get_customer_overview: {
        Args: Record<string, unknown>;
        Returns: CustomerOverviewRow[];
      };
      safe_delete_product: {
        Args: Record<string, unknown>;
        Returns: SafeDeleteResult;
      };
      safe_delete_category: {
        Args: Record<string, unknown>;
        Returns: SafeDeleteResult;
      };
      check_category_cycle: {
        Args: Record<string, unknown>;
        Returns: boolean;
      };
      submit_review: {
        Args: Record<string, unknown>;
        Returns: { success: boolean; action?: string; review_id?: string; error?: string };
      };
      set_default_address: {
        Args: Record<string, unknown>;
        Returns: { success: boolean; error?: string };
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
    };
  };
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
}
