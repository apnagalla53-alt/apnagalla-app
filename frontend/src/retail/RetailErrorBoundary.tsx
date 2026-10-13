import { ui } from "../i18n";
import { Component, type ErrorInfo, type ReactNode } from 'react';

export default class RetailErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Retail render failed', error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="r-empty" role="alert"><h2>Something went wrong</h2>
      <p>This screen could not be displayed.</p>
      {import.meta.env.DEV && <p>{this.state.error.message}</p>}
      <button className="r-btn r-btn--primary" onClick={() => window.location.reload()}>{ui("Try Again")}</button>
      <a href="/retail/home">{ui("Return Home")}</a>
    </div>;
  }
}
