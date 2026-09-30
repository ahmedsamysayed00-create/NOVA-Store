import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export function useWishlist() {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const { data, error } = await supabase
          .from('wishlist_items')
          .select('product_id')
          .eq('user_id', user!.id);
        if (error) throw error;
        setWishlistIds(new Set((data ?? []).map((r) => (r as { product_id: string }).product_id)));
      } catch (err) {
        console.error('Failed to load wishlist:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user]);

  const toggleWishlist = useCallback(
    async (productId: string): Promise<{ error: string | null; added: boolean }> => {
      if (!user) return { error: 'Please sign in to use your wishlist.', added: false };

      try {
        if (wishlistIds.has(productId)) {
          const { error } = await supabase
            .from('wishlist_items')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', productId);
          if (error) return { error: error.message, added: false };
          setWishlistIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
          return { error: null, added: false };
        } else {
          const { error } = await (supabase
            .from('wishlist_items') as unknown as { insert: (v: { product_id: string }) => Promise<{ error: { message: string } | null }> })
            .insert({ product_id: productId });
          if (error) return { error: error.message, added: false };
          setWishlistIds((prev) => new Set(prev).add(productId));
          return { error: null, added: true };
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Wishlist operation failed.', added: false };
      }
    },
    [user, wishlistIds]
  );

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.has(productId),
    [wishlistIds]
  );

  return { wishlistIds, isLoading, toggleWishlist, isInWishlist };
}
