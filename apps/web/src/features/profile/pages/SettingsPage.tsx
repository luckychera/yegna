import { Navigate } from 'react-router';

/** Password and sessions now live in the account workspace. */
export function SettingsPage() {
  return <Navigate to="/profile?section=security" replace />;
}
