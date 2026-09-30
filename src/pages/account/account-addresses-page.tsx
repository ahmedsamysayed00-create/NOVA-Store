import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Address } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedQueryBuilder = any;

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  address_line_1: z.string().min(5, 'Address must be at least 5 characters'),
  address_line_2: z.string().optional(),
  city: z.string().min(2, 'City must be at least 2 characters'),
  state_province: z.string().min(2, 'State/province must be at least 2 characters'),
  postal_code: z.string().min(2, 'Postal code must be at least 2 characters'),
  country: z.string().min(2, 'Country must be at least 2 characters'),
  phone: z
    .string()
    .min(6, 'Phone must be at least 6 characters')
    .optional()
    .or(z.literal('')),
  is_default: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

const EMPTY_VALUES: AddressFormValues = {
  label: '',
  first_name: '',
  last_name: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: 'Egypt',
  phone: '',
  is_default: false,
};

function toFormValues(addr: Address): AddressFormValues {
  return {
    label: addr.label ?? '',
    first_name: addr.first_name,
    last_name: addr.last_name,
    address_line_1: addr.address_line_1,
    address_line_2: addr.address_line_2 ?? '',
    city: addr.city,
    state_province: addr.state_province,
    postal_code: addr.postal_code,
    country: addr.country,
    phone: addr.phone ?? '',
    is_default: addr.is_default,
  };
}

function toInsertPayload(values: AddressFormValues): Record<string, unknown> {
  return {
    label: values.label?.trim() || null,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    address_line_1: values.address_line_1.trim(),
    address_line_2: values.address_line_2?.trim() || null,
    city: values.city.trim(),
    state_province: values.state_province.trim(),
    postal_code: values.postal_code.trim(),
    country: values.country.trim(),
    phone: values.phone?.trim() || null,
    is_default: values.is_default,
  };
}

function toUpdatePayload(values: AddressFormValues): Record<string, unknown> {
  return {
    label: values.label?.trim() || null,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    address_line_1: values.address_line_1.trim(),
    address_line_2: values.address_line_2?.trim() || null,
    city: values.city.trim(),
    state_province: values.state_province.trim(),
    postal_code: values.postal_code.trim(),
    country: values.country.trim(),
    phone: values.phone?.trim() || null,
  };
}

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: Address | null;
  onSaved: () => void;
}

function AddressFormDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: AddressFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!address;

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(address ? toFormValues(address) : EMPTY_VALUES);
    }
  }, [open, address, form]);

  const { isSubmitting } = form.formState;

  async function onSubmit(values: AddressFormValues) {
    try {
      if (isEditing && address) {
        // Update editable fields first (leave is_default to the RPC to avoid
        // colliding with the one-default-per-user unique partial index).
        const payload = toUpdatePayload(values);
        const { error: updateError } = await (supabase
          .from('addresses') as UntypedQueryBuilder)
          .update(payload)
          .eq('id', address.id);

        if (updateError) throw updateError;

        if (values.is_default && !address.is_default) {
          const { error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
            .rpc('set_default_address', {
              p_address_id: address.id,
            });
          if (rpcError) throw rpcError;
        }

        toast({
          title: 'Address updated',
          description: 'Your address has been saved.',
        });
      } else {
        // Insert without defaulting first, then promote via the RPC so the
        // previous default (if any) is un-defaulted atomically.
        const payload = toInsertPayload({ ...values, is_default: false });
        const { data, error: insertError } = await (supabase
          .from('addresses') as UntypedQueryBuilder)
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;

        if (values.is_default && data) {
          const { error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
            .rpc('set_default_address', {
              p_address_id: data.id,
            });
          if (rpcError) throw rpcError;
        }

        toast({
          title: 'Address added',
          description: 'Your new address has been saved.',
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save address';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Address' : 'Add New Address'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Home, Work, etc."
                      maxLength={50}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="First name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Last name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address_line_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line 1</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Street address, building, etc."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line 2 (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="City" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state_province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="State or province" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Postal code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Country" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="Phone number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <Label>Set as default address</Label>
                    <p className="text-xs text-muted-foreground">
                      Use this address for shipping by default.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Address'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: Address | null;
  onDeleted: () => void;
}

function DeleteAddressDialog({
  open,
  onOpenChange,
  address,
  onDeleted,
}: DeleteAddressDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!address) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', address.id);

      if (error) throw error;

      toast({
        title: 'Address deleted',
        description: 'The address has been removed.',
      });
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete address';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete address?</AlertDialogTitle>
          <AlertDialogDescription>
            {address?.is_default ? (
              <>
                This is your <span className="font-semibold">default</span>{' '}
                address. After deleting, you may want to set another address as
                default.
              </>
            ) : (
              'This action cannot be undone. This address will be permanently removed.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AccountAddressesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null);
  const [defaultInFlight, setDefaultInFlight] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data, error: err } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (err) throw err;
      setAddresses(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load addresses';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  function openAdd() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function openEdit(addr: Address) {
    setEditingAddress(addr);
    setFormOpen(true);
  }

  function openDelete(addr: Address) {
    setDeletingAddress(addr);
    setDeleteOpen(true);
  }

  async function setDefault(addr: Address) {
    setDefaultInFlight(addr.id);
    try {
      const { error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
        .rpc('set_default_address', {
          p_address_id: addr.id,
        });
      if (rpcError) throw rpcError;

      toast({
        title: 'Default address updated',
        description: 'This address is now your default.',
      });
      await loadAddresses();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default address';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setDefaultInFlight(null);
    }
  }

  if (isLoading) return <LoadingSection label="Loading addresses" />;
  if (error) return <ErrorState message={error} onRetry={loadAddresses} />;

  if (addresses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            Saved Addresses
          </h2>
        </div>
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a shipping address to speed up checkout."
          action={{ label: 'Add Address', onClick: openAdd }}
        />
        <AddressFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          address={editingAddress}
          onSaved={loadAddresses}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          Saved Addresses
        </h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add New Address
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((addr) => {
          const isDefaulting = defaultInFlight === addr.id;
          return (
            <div
              key={addr.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {addr.label && (
                    <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {addr.label}
                    </p>
                  )}
                  <p className="mt-0.5 font-semibold text-foreground">
                    {addr.first_name} {addr.last_name}
                  </p>
                </div>
                {addr.is_default && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Star className="h-3 w-3 fill-current" />
                    Default
                  </span>
                )}
              </div>

              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <p>{addr.address_line_1}</p>
                {addr.address_line_2 && <p>{addr.address_line_2}</p>}
                <p>
                  {addr.city}, {addr.state_province} {addr.postal_code}
                </p>
                <p>{addr.country}</p>
                {addr.phone && <p>{addr.phone}</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(addr)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDelete(addr)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
                {!addr.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault(addr)}
                    disabled={isDefaulting}
                    className="ml-auto"
                  >
                    {isDefaulting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Star className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Set as Default
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AddressFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        address={editingAddress}
        onSaved={loadAddresses}
      />

      <DeleteAddressDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        address={deletingAddress}
        onDeleted={loadAddresses}
      />
    </div>
  );
}
