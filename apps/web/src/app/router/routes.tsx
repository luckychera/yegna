import { Navigate, createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';

import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { PageLoading } from '@/components/feedback/states';
import { PERMISSIONS } from '@/lib/permissions';
import { ProtectedRoute, PublicOnlyRoute, RequirePermission } from './guards';

/** Lazy route helper: each page becomes its own chunk and is only downloaded when visited. */
function lazyPage<M>(load: () => Promise<M>, pick: (module: M) => React.ComponentType): RouteObject['lazy'] {
  return async () => ({ Component: pick(await load()) });
}

export const appRoutes: RouteObject[] = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    // Registration manages its own signed-in redirect so the "Complete" step can be shown.
    element: <AuthLayout />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', lazy: lazyPage(() => import('@/features/auth/pages/LoginPage'), (m) => m.LoginPage) },
        ],
      },
      { path: '/register', lazy: lazyPage(() => import('@/features/auth/pages/RegisterPage'), (m) => m.RegisterPage) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        hydrateFallbackElement: <PageLoading />,
        children: [
          { path: '/dashboard', lazy: lazyPage(() => import('@/features/dashboard/pages/DashboardPage'), (m) => m.DashboardPage) },
          { path: '/communities', lazy: lazyPage(() => import('@/features/communities/pages/CommunitiesPage'), (m) => m.CommunitiesPage) },
          { path: '/communities/:communityId', lazy: lazyPage(() => import('@/features/communities/pages/CommunityDetailPage'), (m) => m.CommunityDetailPage) },
          { path: '/memberships', lazy: lazyPage(() => import('@/features/memberships/pages/MyMembershipPage'), (m) => m.MyMembershipPage) },
          { path: '/invitations', lazy: lazyPage(() => import('@/features/invitations/pages/InvitationsPage'), (m) => m.InvitationsPage) },
          { path: '/contributions', lazy: lazyPage(() => import('@/features/contributions/pages/ContributionsPage'), (m) => m.ContributionsPage) },
          { path: '/payments', lazy: lazyPage(() => import('@/features/payments/pages/PaymentsPage'), (m) => m.PaymentsPage) },
          { path: '/payments/return', lazy: lazyPage(() => import('@/features/payments/pages/PaymentReturnPage'), (m) => m.PaymentReturnPage) },
          { path: '/notifications', lazy: lazyPage(() => import('@/features/notifications/pages/NotificationsPage'), (m) => m.NotificationsPage) },
          {
            element: <RequirePermission permission={PERMISSIONS.REPORTS_VIEW} />,
            children: [
              { path: '/reports', lazy: lazyPage(() => import('@/features/reports/pages/ReportsPage'), (m) => m.ReportsPage) },
            ],
          },
          { path: '/profile', lazy: lazyPage(() => import('@/features/profile/pages/ProfilePage'), (m) => m.ProfilePage) },
          { path: '/settings', lazy: lazyPage(() => import('@/features/profile/pages/SettingsPage'), (m) => m.SettingsPage) },
          { path: '*', lazy: lazyPage(() => import('@/features/auth/pages/NotFoundPage'), (m) => m.NotFoundPage) },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(appRoutes);

export const createTestRouter = (initialEntries: string[]) => createMemoryRouter(appRoutes, { initialEntries });
