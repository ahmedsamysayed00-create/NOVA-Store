import { useEffect, useState } from 'react';
import { Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSection } from '@/components/common/loading-screen';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/components/common/product-price';
import { fetchCustomers } from '@/lib/admin-service';
import { CustomerDetailDialog } from '@/components/admin/customer-detail-dialog';
import type { CustomerOverviewRow } from '@/types/database';

export function AdminCustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerOverviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCustomers();
        setCustomers(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load customers';
        setError(message);
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [toast]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.full_name?.toLowerCase().includes(q) ?? false) ||
      c.email.toLowerCase().includes(q)
    );
  });

  function handleView(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  if (isLoading) return <LoadingSection label="Loading customers" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} registered user{customers.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="No customers match your search. Registered customers will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Email</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Role</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Orders</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Total Spent</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Joined</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {customer.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        customer.role === 'admin'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {customer.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {customer.order_count}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatPrice(customer.total_spent)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleView(customer.id)}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        customerId={detailId}
      />
    </div>
  );
}
