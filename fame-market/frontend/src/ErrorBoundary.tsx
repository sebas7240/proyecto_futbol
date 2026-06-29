import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from './errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError({
      kind: 'react',
      message: error.message,
      stack: error.stack,
      source: 'react-boundary',
      metadata: {
        componentStack: info.componentStack?.slice(0, 4000)
      }
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="error-fallback">
        <section>
          <h1>Fame Plays necesita recargarse</h1>
          <p>
            Detectamos un error inesperado en la interfaz. Ya quedo reportado
            para revision tecnica.
          </p>
          <button onClick={() => window.location.reload()}>
            Recargar
          </button>
        </section>
      </main>
    );
  }
}
