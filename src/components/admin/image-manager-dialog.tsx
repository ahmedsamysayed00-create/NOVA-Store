import { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Loader2, ImageIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  fetchProductImages,
  uploadProductImage,
  deleteProductImage,
  updateImageSortOrder,
} from '@/lib/admin-service';
import type { ProductImage, Product } from '@/types/database';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ImageManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onChanged?: () => void;
}

export function ImageManagerDialog({
  open,
  onOpenChange,
  product,
  onChanged,
}: ImageManagerDialogProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const data = await fetchProductImages(product.id);
      setImages(data);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load images',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [product, toast]);

  useEffect(() => {
    if (open && product) {
      loadImages();
    }
  }, [open, product, loadImages]);

  async function handleUpload(file: File) {
    if (!product) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Only JPEG, PNG, WebP, and GIF images are allowed.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const nextSortOrder = images.length > 0
        ? Math.max(...images.map((img) => img.sort_order)) + 1
        : 0;
      const newImage = await uploadProductImage(file, product.id, nextSortOrder);
      setImages((prev) => [...prev, newImage]);
      toast({ title: 'Image uploaded', description: file.name });
      onChanged?.();
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(image: ProductImage) {
    setDeletingId(image.id);
    try {
      await deleteProductImage(image);
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      toast({ title: 'Image deleted' });
      onChanged?.();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete image',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function moveImage(index: number, direction: 'up' | 'down') {
    if (!product) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const updated = [...images];
    const a = updated[index];
    const b = updated[targetIndex];
    const tempOrder = a.sort_order;
    updated[index] = { ...a, sort_order: b.sort_order };
    updated[targetIndex] = { ...b, sort_order: tempOrder };
    setImages(updated);

    try {
      await updateImageSortOrder(a.id, b.sort_order);
      await updateImageSortOrder(b.id, tempOrder);
    } catch (err) {
      toast({
        title: 'Reorder failed',
        description: err instanceof Error ? err.message : 'Failed to reorder image',
        variant: 'destructive',
      });
      loadImages();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Images — {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-muted/50">
              <input
                type="file"
                className="hidden"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload an image (JPEG, PNG, WebP, GIF — max 5MB)
                  </span>
                </>
              )}
            </label>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm">No images yet. Upload one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={img.url}
                    alt={img.alt_text ?? product?.name ?? ''}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, 'down')}
                      disabled={index === images.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => handleDelete(img)}
                      disabled={deletingId === img.id}
                    >
                      {deletingId === img.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {index === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
