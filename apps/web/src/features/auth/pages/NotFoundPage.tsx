import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/states';
import { buttonVariants } from '@/components/ui/button-variants';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<Compass className="h-6 w-6" aria-hidden />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link to="/dashboard" className={buttonVariants({})}>
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
