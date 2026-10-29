import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Last line of defence: a crashing component never blanks the whole application. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <h1 className="text-h2 font-semibold text-ink">Something went wrong.</h1>
        <p className="max-w-sm text-body text-ink-secondary">Please refresh the page or try again.</p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    );
  }
}
