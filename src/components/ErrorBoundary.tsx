import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, marginBottom: 6, color: 'var(--danger)' }}>
            渲染出错
          </p>
          <p style={{ fontSize: 'var(--fs-sm)' }}>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
