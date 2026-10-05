import React from 'react';
import logger from '../lib/logger';

/**
 * Catches render-time errors anywhere below it. Without this, a single thrown
 * error unmounts the whole tree and the user is left looking at a blank white
 * page with nothing but a console entry to go on.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Unhandled render error', { error, componentStack: errorInfo?.componentStack });
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-canvas px-6">
        <div className="mx-auto max-w-xl pt-16 sm:pt-24" role="alert">
          <p className="text-small font-medium text-danger-fg">Something went wrong</p>
          <h1 className="mt-2 text-display font-semibold text-fg">This page stopped working</h1>
          <p className="mt-2 text-body text-fg-muted">
            An unexpected error stopped the page from showing. Your work is saved on the server; reloading usually clears it.
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-6 max-h-48 overflow-auto rounded-lg bg-code p-3 text-left font-mono text-caption text-code-fg">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-9 items-center rounded bg-accent px-3.5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Reload page
            </button>
            <a href="/home" className="inline-flex h-9 items-center rounded px-3.5 text-body font-medium text-fg ring-1 ring-inset ring-line transition-colors hover:bg-sunken">
              Go to Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
