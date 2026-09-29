import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Gruzli ErrorBoundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const message = this.state.error?.message || "Неизвестная ошибка";

      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={21} className="text-destructive" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold">Временная ошибка интерфейса</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Грузли не должен оставаться на этом экране. Попробуйте восстановить приложение.
                </p>
              </div>
            </div>

            <details className="mt-5 rounded-2xl border border-border bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                Техническая информация
              </summary>
              <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
                {message}
              </p>
            </details>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold"
              >
                <RefreshCw size={15} />
                Повторить
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
              >
                Обновить
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
