/*
# NOVA Store — Phase 2.75 Test Catalog & Shipping Config

## Overview
Creates a realistic development catalog for NOVA Store, a premium tech
accessories brand. All data is real database records — no hardcoded
frontend data, no mock APIs, no static JSON.

## Data Created

### Shipping Configuration
- Flat rate: $5.99
- Free shipping threshold: $75.00
- COD fee: $2.00

### Categories (6)
1. Keyboards (slug: keyboards)
2. Mice (slug: mice)
3. Headsets (slug: headsets)
4. Chargers (slug: chargers)
5. Power Banks (slug: power-banks)
6. Accessories (slug: accessories)

### Products (15)
Each with realistic name, description, price, compare-at price where
appropriate, stock, SKU, brand, category, and flags (featured,
bestseller, on offer). All products are active.

### Product Images
Each product has 1-2 images from Pexels (publicly accessible URLs).
Several products have multiple images to test the gallery.

## Security
No security changes — this is data only. All inserts run with
service_role privileges via the migration tool. RLS policies on
products, categories, and product_images allow public SELECT for
active records, so the anon-key frontend can read this catalog.
*/

-- ============================================================
-- SHIPPING CONFIG (ensure row exists)
-- ============================================================

INSERT INTO public.shipping_config (id, flat_rate_fee, free_shipping_threshold, cod_fee)
VALUES (1, 5.99, 75.00, 2.00)
ON CONFLICT (id) DO UPDATE SET
  flat_rate_fee = EXCLUDED.flat_rate_fee,
  free_shipping_threshold = EXCLUDED.free_shipping_threshold,
  cod_fee = EXCLUDED.cod_fee;

-- ============================================================
-- CATEGORIES
-- ============================================================

INSERT INTO public.categories (name, slug, description, is_active, sort_order) VALUES
('Keyboards', 'keyboards', 'Mechanical and wireless keyboards for typing and gaming', true, 1),
('Mice', 'mice', 'Wired and wireless mice for productivity and gaming', true, 2),
('Headsets', 'headsets', 'Over-ear and on-ear headsets for music and gaming', true, 3),
('Chargers', 'chargers', 'USB-C, GaN, and fast chargers for all devices', true, 4),
('Power Banks', 'power-banks', 'Portable power banks to keep you charged on the go', true, 5),
('Accessories', 'accessories', 'Mouse pads, cables, and other desk essentials', true, 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- PRODUCTS
-- ============================================================

-- Helper: insert product and return id via slug lookup
-- We use a DO block to insert products and their images together

DO $$
DECLARE
  v_kb_cat uuid; v_mouse_cat uuid; v_hs_cat uuid;
  v_chrg_cat uuid; v_pb_cat uuid; v_acc_cat uuid;
  v_p uuid;
BEGIN
  SELECT id INTO v_kb_cat FROM public.categories WHERE slug = 'keyboards';
  SELECT id INTO v_mouse_cat FROM public.categories WHERE slug = 'mice';
  SELECT id INTO v_hs_cat FROM public.categories WHERE slug = 'headsets';
  SELECT id INTO v_chrg_cat FROM public.categories WHERE slug = 'chargers';
  SELECT id INTO v_pb_cat FROM public.categories WHERE slug = 'power-banks';
  SELECT id INTO v_acc_cat FROM public.categories WHERE slug = 'accessories';

  -- 1. Nova Mechanical Pro Keyboard
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Mechanical Pro Keyboard',
    'nova-mechanical-pro-keyboard',
    'A full-size mechanical keyboard with hot-swappable switches, PBT keycaps, and per-key RGB backlighting. Built with an aluminum frame for a premium typing feel and acoustic dampening foam for a deep, thocky sound profile.',
    'Hot-swappable mechanical keyboard with RGB and aluminum frame',
    v_kb_cat, 'NOVA-KB-001', 129.99, 159.99, 25, true, true, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/9020272/pexels-photo-9020272.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Mechanical Pro Keyboard close-up', 0),
    (v_p, 'https://images.pexels.com/photos/5380584/pexels-photo-5380584.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Mechanical Pro Keyboard with RGB lighting', 1)
  ON CONFLICT DO NOTHING;

  -- 2. Nova Wireless Mechanical Keyboard
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Wireless Mechanical Keyboard',
    'nova-wireless-mechanical-keyboard',
    'A compact 75% wireless mechanical keyboard with Bluetooth 5.1 and 2.4GHz dongle connectivity. Features brown tactile switches, a 4000mAh battery lasting up to 72 hours, and a CNC aluminum top case.',
    '75% wireless mechanical keyboard with Bluetooth and 2.4GHz',
    v_kb_cat, 'NOVA-KB-002', 99.99, NULL, 18, false, true, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/4145372/pexels-photo-4145372.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Wireless Mechanical Keyboard', 0)
  ON CONFLICT DO NOTHING;

  -- 3. Nova Precision Gaming Mouse
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Precision Gaming Mouse',
    'nova-precision-gaming-mouse',
    'A lightweight 58g gaming mouse with a 26,000 DPI optical sensor, 650 IPS tracking speed, and 1ms wireless polling. Includes 6 programmable buttons, PTFE feet, and a 90-hour battery life.',
    '58g wireless gaming mouse with 26K DPI sensor',
    v_mouse_cat, 'NOVA-MS-001', 69.99, 89.99, 40, true, true, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/31018745/pexels-photo-31018745.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Precision Gaming Mouse with RGB desk setup', 0),
    (v_p, 'https://images.pexels.com/photos/18966481/pexels-photo-18966481.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Precision Gaming Mouse in use', 1)
  ON CONFLICT DO NOTHING;

  -- 4. Nova Wireless Silent Mouse
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Wireless Silent Mouse',
    'nova-wireless-silent-mouse',
    'A slim wireless mouse with silent clicks, a 2,400 DPI sensor, and a USB-C charging port. Perfect for offices and shared workspaces. Up to 4 months on a single charge.',
    'Silent-click wireless mouse with USB-C charging',
    v_mouse_cat, 'NOVA-MS-002', 34.99, NULL, 55, false, false, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/5861328/pexels-photo-5861328.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Wireless Silent Mouse on desk', 0)
  ON CONFLICT DO NOTHING;

  -- 5. Nova RGB Gaming Headset
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova RGB Gaming Headset',
    'nova-rgb-gaming-headset',
    'Over-ear gaming headset with 50mm neodymium drivers, 7.1 surround sound, RGB earcup lighting, and a detachable noise-canceling boom mic. Memory foam earpads with protein leather for 12-hour comfort.',
    '7.1 surround sound gaming headset with RGB and boom mic',
    v_hs_cat, 'NOVA-HS-001', 79.99, 99.99, 30, true, true, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/10670819/pexels-photo-10670819.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova RGB Gaming Headset with neon lighting', 0),
    (v_p, 'https://images.pexels.com/photos/9742608/pexels-photo-9742608.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova RGB Gaming Headset on desk', 1)
  ON CONFLICT DO NOTHING;

  -- 6. Nova Wireless Headset
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Wireless Headset',
    'nova-wireless-headset',
    'Wireless over-ear headset with active noise cancellation, 40mm drivers, and Bluetooth 5.3 multipoint pairing. Up to 40 hours of playback with a 10-minute quick charge giving 4 hours of use.',
    'ANC wireless headset with Bluetooth 5.3 multipoint',
    v_hs_cat, 'NOVA-HS-002', 119.99, NULL, 22, false, true, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/18966483/pexels-photo-18966483.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Wireless Headset in use', 0)
  ON CONFLICT DO NOTHING;

  -- 7. Nova USB-C Fast Charger 65W
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova USB-C Fast Charger 65W',
    'nova-usb-c-fast-charger-65w',
    'A compact 65W USB-C wall charger with Power Delivery 3.0 and PPS support. Charges laptops, phones, and tablets at full speed. GaN technology keeps it 40% smaller than standard chargers.',
    '65W GaN USB-C charger with Power Delivery 3.0',
    v_chrg_cat, 'NOVA-CH-001', 39.99, 49.99, 60, true, false, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/3921632/pexels-photo-3921632.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova USB-C Fast Charger 65W', 0)
  ON CONFLICT DO NOTHING;

  -- 8. Nova GaN Charger 100W
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova GaN Charger 100W',
    'nova-gan-charger-100w',
    'A 100W GaN II charger with two USB-C ports and one USB-A port. Simultaneously charges a laptop, phone, and accessories. Foldable plug design for travel. Includes a 1.5m braided USB-C cable.',
    '100W GaN charger with dual USB-C and USB-A ports',
    v_chrg_cat, 'NOVA-CH-002', 59.99, NULL, 35, false, true, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/3921632/pexels-photo-3921632.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova GaN Charger 100W', 0)
  ON CONFLICT DO NOTHING;

  -- 9. Nova Power Bank 20000mAh
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Power Bank 20000mAh',
    'nova-power-bank-20000mah',
    'A 20,000mAh power bank with 65W USB-C PD output, enough to charge a laptop on the go. Digital LED capacity display, pass-through charging, and a slim aluminum body that fits in a bag pocket.',
    '20,000mAh power bank with 65W USB-C PD output',
    v_pb_cat, 'NOVA-PB-001', 54.99, 69.99, 28, true, true, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/4072683/pexels-photo-4072683.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Power Bank 20000mAh with USB cable', 0),
    (v_p, 'https://images.pexels.com/photos/6296911/pexels-photo-6296911.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Power Bank 20000mAh in hand', 1)
  ON CONFLICT DO NOTHING;

  -- 10. Nova Power Bank 10000mAh
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Power Bank 10000mAh',
    'nova-power-bank-10000mah',
    'A compact 10,000mAh power bank with 22.5W USB-C PD and 18W USB-A output. Slim enough to slip into a pocket. LED indicator lights show remaining charge at a glance.',
    '10,000mAh compact power bank with 22.5W fast charging',
    v_pb_cat, 'NOVA-PB-002', 29.99, NULL, 45, false, false, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/37475677/pexels-photo-37475677.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Power Bank 10000mAh charging a phone', 0)
  ON CONFLICT DO NOTHING;

  -- 11. Nova USB-C Cable 1.5m
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova USB-C Cable 1.5m',
    'nova-usb-c-cable-1-5m',
    'A braided USB-C to USB-C cable with 100W power delivery support and 480 Mbps data transfer. Nylon-braided jacket rated for 30,000 bend cycles. Available in 1.5m length.',
    'Braided USB-C cable with 100W PD, 1.5m',
    v_acc_cat, 'NOVA-AC-001', 14.99, 19.99, 100, false, true, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/4219867/pexels-photo-4219867.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova USB-C Cable 1.5m', 0)
  ON CONFLICT DO NOTHING;

  -- 12. Nova Premium Mouse Pad XL
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Premium Mouse Pad XL',
    'nova-premium-mouse-pad-xl',
    'An extra-large desk mat with a micro-woven cloth surface optimized for both optical and laser sensors. Anti-slip rubber base, stitched edges to prevent fraying, and a water-resistant coating. 900x400mm.',
    'XL desk mat with micro-woven surface and stitched edges',
    v_acc_cat, 'NOVA-AC-002', 24.99, NULL, 70, false, false, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/18155963/pexels-photo-18155963.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Premium Mouse Pad XL with keyboard and mouse', 0),
    (v_p, 'https://images.pexels.com/photos/8524586/pexels-photo-8524586.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Premium Mouse Pad XL in workspace', 1)
  ON CONFLICT DO NOTHING;

  -- 13. Nova Compact 60% Keyboard
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Compact 60% Keyboard',
    'nova-compact-60-percent-keyboard',
    'A ultra-compact 60% wired mechanical keyboard with red linear switches, double-shot PBT keycaps, and customizable RGB backlighting. Perfect for minimal desks and travel. USB-C detachable cable included.',
    '60% mechanical keyboard with red switches and RGB',
    v_kb_cat, 'NOVA-KB-003', 59.99, 74.99, 15, false, false, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/9020272/pexels-photo-9020272.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Compact 60% Keyboard', 0)
  ON CONFLICT DO NOTHING;

  -- 14. Nova Ergonomic Vertical Mouse
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Ergonomic Vertical Mouse',
    'nova-ergonomic-vertical-mouse',
    'A vertical ergonomic mouse designed to reduce wrist strain. 6 programmable buttons, adjustable DPI up to 4,000, and a rechargeable battery with 3 months of use per charge. Silent-click switches.',
    'Vertical ergonomic mouse for wrist comfort',
    v_mouse_cat, 'NOVA-MS-003', 44.99, NULL, 20, false, false, false, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/5861328/pexels-photo-5861328.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Ergonomic Vertical Mouse on desk', 0)
  ON CONFLICT DO NOTHING;

  -- 15. Nova Solar Power Bank 5000mAh
  INSERT INTO public.products (name, slug, description, short_description, category_id, sku, price, compare_at_price, stock, is_featured, is_bestseller, is_on_offer, is_active, brand)
  VALUES (
    'Nova Solar Power Bank 5000mAh',
    'nova-solar-power-bank-5000mah',
    'A rugged 5,000mAh solar power bank designed for outdoor adventures. IP67 water and dust resistant, built-in LED flashlight, and a carabiner clip. Charges via solar panel or USB-C.',
    'Rugged solar power bank with IP67 rating and LED light',
    v_pb_cat, 'NOVA-PB-003', 39.99, 49.99, 12, false, false, true, true, 'NOVA'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, short_description = EXCLUDED.short_description,
    category_id = EXCLUDED.category_id, sku = EXCLUDED.sku, price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price, stock = EXCLUDED.stock,
    is_featured = EXCLUDED.is_featured, is_bestseller = EXCLUDED.is_bestseller,
    is_on_offer = EXCLUDED.is_on_offer, is_active = EXCLUDED.is_active, brand = EXCLUDED.brand
  RETURNING id INTO v_p;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order) VALUES
    (v_p, 'https://images.pexels.com/photos/518530/pexels-photo-518530.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Nova Solar Power Bank 5000mAh', 0)
  ON CONFLICT DO NOTHING;

END $$;
