import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          alignItems: 'center',
          background: '#1a1a2e',
          color: '#ff6b6b',
          display: 'flex',
          flexDirection: 'column',
          fontSize: 12,
          height: '100%',
          justifyContent: 'center',
          padding: 16,
          width: '100%',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
            {this.props.label ?? 'Component'} failed to load
          </div>
          <div style={{ color: '#888', fontSize: 11, maxWidth: 300, textAlign: 'center', wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
