/**
 * EVOLIX Trade ERP — Error Boundary.
 *
 * Catches React rendering errors gracefully.
 * Shows a user-friendly error state — never exposes stack traces.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to diagnostic system — never expose to user
    console.error('[EVOLIX ErrorBoundary]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            padding: '2.5rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '480px',
            width: '100%',
          }}>
            <h1 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.75rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Please refresh the page or contact support.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--color-primary-600)',
                color: '#fff',
                border: 'none',
                padding: '0.625rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
