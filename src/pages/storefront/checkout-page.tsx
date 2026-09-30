import { useState, useCallback, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock, ShoppingBag, Check, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingSection } from '@/components/common/loading-screen';
import { formatPrice } from '@/components/common/product-price';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import type { PlaceOrderResult, Address } from '@/types/database';
import { cn } from '@/lib/utils';

const checkoutSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(6, 'A valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  notes: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const { items, summary, isLoading, clearCart } = useCart();
  const { isAuthenticated, user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; orderId: string } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useManualEntry, setUseManualEntry] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      full_name: profile?.full_name ?? user?.user_metadata?.full_name ?? '',
      phone: profile?.phone ?? '',
      address: '',
      city: '',
      notes: '',
    },
  });

  useEffect(() => {
    document.title = 'Checkout — NOVA Store';
  }, []);

  // Load saved addresses
  useEffect(() => {
    if (!user) return;
    async function loadAddresses() {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false });
      const addrList = (data ?? []) as Address[];
      setAddresses(addrList);
      const defaultAddr = addrList.find((a) => a.is_default) ?? addrList[0];
      if (defaultAddr) {
        selectAddress(defaultAddr);
      } else {
        setUseManualEntry(true);
      }
    }
    loadAddresses();
  }, [user]);

  const selectAddress = useCallback((addr: Address) => {
    setSelectedAddressId(addr.id);
    setUseManualEntry(false);
    setValue('full_name', `${addr.first_name} ${addr.last_name}`);
    setValue('phone', addr.phone ?? '');
    setValue('address', `${addr.address_line_1}${addr.address_line_2 ? ', ' + addr.address_line_2 : ''}`);
    setValue('city', `${addr.city}, ${addr.state_province} ${addr.postal_code}`);
  }, [setValue]);

  const switchToManual = useCallback(() => {
    setSelectedAddressId(null);
    setUseManualEntry(true);
    setValue('full_name', profile?.full_name ?? user?.user_metadata?.full_name ?? '');
    setValue('phone', profile?.phone ?? '');
    setValue('address', '');
    setValue('city', '');
  }, [setValue, profile, user]);

  const onSubmit = useCallback(
    async (data: CheckoutForm) => {
      setSubmitting(true);
      setOrderError(null);
      try {
        const shippingAddress = {
          full_name: data.full_name,
          phone: data.phone,
          address: data.address,
          city: data.city,
        };

        const { data: rpcData, error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: PlaceOrderResult | null; error: { message: string } | null }> })
          .rpc('place_order', {
            p_shipping_address: shippingAddress,
            p_notes: data.notes ?? null,
          });

        if (rpcError) {
          setOrderError('An error occurred while placing your order. Please try again.');
          setSubmitting(false);
          return;
        }

        const result = rpcData as PlaceOrderResult;
        if (!result.success) {
          setOrderError(result.error ?? 'Failed to place order.');
          setSubmitting(false);
          return;
        }

        await clearCart();
        setOrderResult({
          orderNumber: result.order_number ?? '',
          orderId: result.order_id ?? '',
        });
      } catch {
        setOrderError('An unexpected error occurred. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [clearCart]
  );

  // Order confirmation screen
  if (orderResult) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Order Placed!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Thank you for your order. We've received your request and will process it shortly.
          </p>
          <div className="mt-6 rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Order Number</p>
            <p className="mt-1 font-display text-xl font-bold text-primary">{orderResult.orderNumber}</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/account/orders">
                View Order History
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/products">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: '/checkout' }} replace />;
  }

  if (isLoading) return <LoadingSection label="Loading checkout" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground sm:text-4xl">Checkout</h1>
        <EmptyState
          icon={Lock}
          title="Your cart is empty"
          description="Add products to your cart before proceeding to checkout."
          action={{ label: 'Browse Products', href: '/products' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-foreground sm:text-4xl">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <div>
          {orderError && (
            <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {orderError}
            </div>
          )}

          {/* Saved address selection */}
          {addresses.length > 0 && (
            <div className="mb-5 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <MapPin className="h-5 w-5 text-primary" />
                Shipping Address
              </h2>
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => selectAddress(addr)}
                    className={cn(
                      'w-full rounded-lg border-2 p-4 text-left transition-colors',
                      selectedAddressId === addr.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80'
                    )}
                    aria-pressed={selectedAddressId === addr.id}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {addr.first_name} {addr.last_name}
                      </span>
                      {addr.is_default && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {addr.city}, {addr.state_province} {addr.postal_code}
                    </p>
                    {addr.phone && <p className="text-sm text-muted-foreground">{addr.phone}</p>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={switchToManual}
                  className={cn(
                    'w-full rounded-lg border-2 p-4 text-left transition-colors',
                    useManualEntry
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border/80'
                  )}
                  aria-pressed={useManualEntry}
                >
                  <span className="text-sm font-medium text-foreground">Enter a different address</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Shipping details form */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Shipping Details
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Cash on Delivery — pay when your order arrives.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    {...register('full_name')}
                    placeholder="Jane Doe"
                    className={errors.full_name ? 'border-destructive' : ''}
                    aria-invalid={!!errors.full_name}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-destructive" role="alert">{errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder="+1 234 567 8900"
                    className={errors.phone ? 'border-destructive' : ''}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive" role="alert">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder="123 Main Street, Apt 4B"
                    className={errors.address ? 'border-destructive' : ''}
                    aria-invalid={!!errors.address}
                  />
                  {errors.address && (
                    <p className="text-xs text-destructive" role="alert">{errors.address.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City / Governorate</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder="New York"
                    className={errors.city ? 'border-destructive' : ''}
                    aria-invalid={!!errors.city}
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive" role="alert">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Order Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Any special instructions for delivery…"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full font-semibold" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing Order…
                </>
              ) : (
                <>
                  Place Order — {formatPrice(summary?.total ?? 0)}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Order summary */}
        <div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Order Summary</h2>
            <div className="mb-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{formatPrice(summary?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium text-foreground">
                  {(summary?.shipping_cost ?? 0) === 0 ? 'Free' : formatPrice(summary?.shipping_cost ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">COD Fee</span>
                <span className="font-medium text-foreground">{formatPrice(summary?.cod_fee ?? 0)}</span>
              </div>
              <div className="border-t border-border pt-2.5">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-display text-xl font-bold text-foreground">
                    {formatPrice(summary?.total ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
