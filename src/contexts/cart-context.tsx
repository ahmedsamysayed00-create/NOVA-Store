import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import type { CartItemWithProduct, CartSummary } from '@/types/database';

interface CartContextValue {
  items: CartItemWithProduct[];
  summary: CartSummary | null;
  isLoading: boolean;
  itemCount: number;
  addToCart: (productId: string, quantity?: number) => Promise<{ error: string | null }>;
  updateQuantity: (productId: string, quantity: number) => Promise<{ error: string | null }>;
  removeFromCart: (productId: string) => Promise<{ error: string | null }>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const emptySummary: CartSummary = {
  subtotal: 0,
  shipping_cost: 0,
  cod_fee: 0,
  total: 0,
  item_count: 0,
};

// The supabase-js v2 generic types fail to resolve Insert/Update for our
// Database schema, causing insert()/update() to accept `never`. We cast the
// query builder to an untyped-any for write operations only — the runtime
// behavior is correct, this is purely a TypeScript generic resolution issue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedQueryBuilder = any;

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setSummary(emptySummary);
      setIsLoading(false);
      return;
    }
    try {
      const [cartRes, summaryRes] = await Promise.all([
        supabase
          .from('cart_items')
          .select('*, product:products(*, product_images(*))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_cart_summary'),
      ]);

      if (cartRes.error) throw cartRes.error;
      setItems((cartRes.data ?? []) as unknown as CartItemWithProduct[]);

      if (summaryRes.error) {
        console.error('Failed to fetch cart summary:', summaryRes.error.message);
        setSummary(emptySummary);
      } else {
        setSummary(summaryRes.data as CartSummary);
      }
    } catch (err) {
      console.error('Failed to load cart:', err);
      setItems([]);
      setSummary(emptySummary);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Please sign in to add items to your cart.' };
      try {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .maybeSingle();

        if (existing) {
          const newQty = (existing as { quantity: number }).quantity + quantity;
          const { error } = await (supabase.from('cart_items') as UntypedQueryBuilder)
            .update({ quantity: newQty })
            .eq('id', (existing as { id: string }).id);
          if (error) return { error: error.message };
        } else {
          const { error } = await (supabase.from('cart_items') as UntypedQueryBuilder)
            .insert({ product_id: productId, quantity });
          if (error) return { error: error.message };
        }
        await refreshCart();
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to add item to cart.' };
      }
    },
    [user, refreshCart]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Please sign in to update your cart.' };
      if (quantity <= 0) {
        return removeFromCartInternal(productId, user.id);
      }
      try {
        const { error } = await (supabase.from('cart_items') as UntypedQueryBuilder)
          .update({ quantity })
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) return { error: error.message };
        await refreshCart();
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to update quantity.' };
      }
    },
    [user, refreshCart]
  );

  const removeFromCartInternal = async (
    productId: string,
    userId: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      if (error) return { error: error.message };
      await refreshCart();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove item.' };
    }
  };

  const removeFromCart = useCallback(
    async (productId: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Please sign in to modify your cart.' };
      return removeFromCartInternal(productId, user.id);
    },
    [user]
  );

  const clearCart = useCallback(async () => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    setItems([]);
    setSummary(emptySummary);
  }, [user]);

  const value: CartContextValue = {
    items,
    summary,
    isLoading,
    itemCount: summary?.item_count ?? 0,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
