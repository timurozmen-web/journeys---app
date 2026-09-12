import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Without this, any render error anywhere in the tree silently unmounts
// the whole app -- a blank screen with no way to tell what happened.
// This catches it and shows the real error instead, so a bug report can
// say what actually broke rather than just "blank".
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Journeys crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 20px', fontFamily: 'system-ui, sans-serif', color: '#16171C', background: '#F7F6F2', minHeight: '100vh', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Something went wrong</div>
          <p style={{ fontSize: 14, color: '#5C5D66', lineHeight: 1.5, marginBottom: 16 }}>
            The app hit an error and couldn't continue. The details below are safe to screenshot and share.
          </p>
          <div style={{ background: '#fff', border: '1px solid #E4E4DD', borderRadius: 10, padding: 14, fontSize: 12.5, fontFamily: 'ui-monospace, monospace', color: '#D23C3C', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 20 }}>
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '#/'; }}
            style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#1E3A8F', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
