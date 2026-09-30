import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/common/loading-screen';

// Redirects authenticated users away from auth pages (login/register)
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}
