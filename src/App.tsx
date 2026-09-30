import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { CartProvider } from '@/contexts/cart-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { PublicOnlyRoute } from '@/components/auth/public-only-route';
import { StorefrontLayout } from '@/components/storefront/storefront-layout';
import { LoadingScreen } from '@/components/common/loading-screen';

// Eagerly load storefront-critical pages (above the fold)
import { HomePage } from '@/pages/storefront/home-page';
import { ProductsPage } from '@/pages/storefront/products-page';

// Lazy load all other route components for code splitting
const ProductDetailPage = lazy(() => import('@/pages/storefront/product-detail-page').then((m) => ({ default: m.ProductDetailPage })));
const CartPage = lazy(() => import('@/pages/storefront/cart-page').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('@/pages/storefront/checkout-page').then((m) => ({ default: m.CheckoutPage })));

const LoginPage = lazy(() => import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/register-page').then((m) => ({ default: m.RegisterPage })));

const AccountLayout = lazy(() => import('@/pages/account/account-layout').then((m) => ({ default: m.AccountLayout })));
const AccountDashboardPage = lazy(() => import('@/pages/account/account-dashboard-page').then((m) => ({ default: m.AccountDashboardPage })));
const AccountOrdersPage = lazy(() => import('@/pages/account/account-orders-page').then((m) => ({ default: m.AccountOrdersPage })));
const AccountAddressesPage = lazy(() => import('@/pages/account/account-addresses-page').then((m) => ({ default: m.AccountAddressesPage })));
const AccountWishlistPage = lazy(() => import('@/pages/account/account-wishlist-page').then((m) => ({ default: m.AccountWishlistPage })));

const AdminLayout = lazy(() => import('@/pages/admin/admin-layout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() => import('@/pages/admin/admin-dashboard-page').then((m) => ({ default: m.AdminDashboardPage })));
const AdminProductsPage = lazy(() => import('@/pages/admin/admin-products-page').then((m) => ({ default: m.AdminProductsPage })));
const AdminOrdersPage = lazy(() => import('@/pages/admin/admin-orders-page').then((m) => ({ default: m.AdminOrdersPage })));
const AdminCustomersPage = lazy(() => import('@/pages/admin/admin-customers-page').then((m) => ({ default: m.AdminCustomersPage })));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/admin-categories-page').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminAnalyticsPage = lazy(() => import('@/pages/admin/admin-analytics-page').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminInventoryPage = lazy(() => import('@/pages/admin/admin-inventory-page').then((m) => ({ default: m.AdminInventoryPage })));

const NotFoundPage = lazy(() => import('@/pages/error/not-found-page').then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazy(() => import('@/pages/error/unauthorized-page').then((m) => ({ default: m.UnauthorizedPage })));

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
        <Routes>
          {/* Storefront */}
          <Route element={<StorefrontLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<Suspense fallback={<LoadingScreen />}><ProductDetailPage /></Suspense>} />
            <Route path="/cart" element={<Suspense fallback={<LoadingScreen />}><CartPage /></Suspense>} />
            <Route path="/checkout" element={<Suspense fallback={<LoadingScreen />}><CheckoutPage /></Suspense>} />
          </Route>

          {/* Auth */}
          <Route
            path="/login"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              </Suspense>
            }
          />
          <Route
            path="/register"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              </Suspense>
            }
          />

          {/* Account (authenticated customers) */}
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingScreen />}>
                  <AccountLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Suspense fallback={<LoadingScreen />}><AccountDashboardPage /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<LoadingScreen />}><AccountOrdersPage /></Suspense>} />
            <Route path="addresses" element={<Suspense fallback={<LoadingScreen />}><AccountAddressesPage /></Suspense>} />
            <Route path="wishlist" element={<Suspense fallback={<LoadingScreen />}><AccountWishlistPage /></Suspense>} />
          </Route>

          {/* Admin (authenticated admins only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<LoadingScreen />}>
                  <AdminLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Suspense fallback={<LoadingScreen />}><AdminDashboardPage /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<LoadingScreen />}><AdminProductsPage /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<LoadingScreen />}><AdminOrdersPage /></Suspense>} />
            <Route path="inventory" element={<Suspense fallback={<LoadingScreen />}><AdminInventoryPage /></Suspense>} />
            <Route path="customers" element={<Suspense fallback={<LoadingScreen />}><AdminCustomersPage /></Suspense>} />
            <Route path="categories" element={<Suspense fallback={<LoadingScreen />}><AdminCategoriesPage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<LoadingScreen />}><AdminAnalyticsPage /></Suspense>} />
          </Route>

          {/* Error pages */}
          <Route path="/unauthorized" element={<Suspense fallback={<LoadingScreen />}><UnauthorizedPage /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<LoadingScreen />}><NotFoundPage /></Suspense>} />
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
