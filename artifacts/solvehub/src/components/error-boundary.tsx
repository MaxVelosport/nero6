import { Component, ReactNode, ErrorInfo } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "Неизвестная ошибка" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } else {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, errorMessage: "" });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#09091a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Что-то пошло не так</h1>
          <p className="text-slate-400 mb-2 text-sm leading-relaxed">
            Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернитесь на главную.
          </p>
          {this.state.errorMessage && (
            <div className="mb-6 px-4 py-2.5 bg-red-500/8 border border-red-500/15 rounded-xl">
              <p className="text-xs text-red-400 font-mono text-left break-all">{this.state.errorMessage}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={this.handleReload} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0">
              <RotateCcw className="w-4 h-4 mr-2" /> Обновить страницу
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="border-white/15 text-slate-300">
              <Home className="w-4 h-4 mr-2" /> На главную
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
