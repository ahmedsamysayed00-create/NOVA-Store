import { supabase } from '@/lib/supabase';
import type { ShippingConfig } from '@/types/database';

let cachedConfig: ShippingConfig | null = null;

export async function getShippingConfig(): Promise<ShippingConfig> {
  if (cachedConfig) return cachedConfig;
  const { data, error } = await supabase
    .from('shipping_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Shipping configuration not found.');
  cachedConfig = data as ShippingConfig;
  return cachedConfig;
}

export function calculateShipping(
  subtotal: number,
  config: ShippingConfig
): { shippingCost: number; codFee: number; total: number } {
  const shippingCost = subtotal >= config.free_shipping_threshold ? 0 : config.flat_rate_fee;
  const codFee = config.cod_fee;
  const total = subtotal + shippingCost + codFee;
  return { shippingCost, codFee, total };
}
