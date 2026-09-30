import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Package, MapPin, Heart, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const profileSchema = z.object({
  full_name: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 2, 'Full name must be at least 2 characters'),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, 'Phone must be at least 6 characters'),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function AccountDashboardPage() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [counts, setCounts] = useState({ orders: 0, addresses: 0, wishlist: 0 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    },
  });

  // Keep form defaults in sync with the profile when entering edit mode
  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    });
  }, [profile, reset]);

  // Fetch real counts for the stats grid
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;

    async function loadCounts() {
      const uid = user!.id;
      const [ordersRes, addressesRes, wishlistRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ]);

      if (!mounted) return;
      setCounts({
        orders: ordersRes.count ?? 0,
        addresses: addressesRes.count ?? 0,
        wishlist: wishlistRes.count ?? 0,
      });
    }

    loadCounts();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from('profiles') as unknown as { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } })
        .update({
          full_name: data.full_name?.trim() || null,
          phone: data.phone?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        toast({
          title: 'Update failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      await refreshProfile();
      toast({
        title: 'Profile updated',
        description: 'Your profile information has been saved.',
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    });
    setIsEditing(false);
  };

  const stats = [
    { label: 'Orders', value: counts.orders, icon: Package, href: '/account/orders' },
    { label: 'Addresses', value: counts.addresses, icon: MapPin, href: '/account/addresses' },
    { label: 'Wishlist Items', value: counts.wishlist, icon: Heart, href: '/account/wishlist' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile Information</CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary">
                  {(profile?.full_name ?? profile?.email ?? 'U')[0]?.toUpperCase()}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    {profile?.full_name ?? 'No name set'}
                  </p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  placeholder="Jane Doe"
                  disabled={isSaving}
                  className={errors.full_name ? 'border-destructive' : ''}
                  {...register('full_name')}
                />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  disabled={isSaving}
                  className={errors.phone ? 'border-destructive' : ''}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary">
                {(profile?.full_name ?? profile?.email ?? 'U')[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {profile?.full_name ?? 'No name set'}
                </p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && (
                  <p className="text-sm text-muted-foreground">{profile.phone}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
