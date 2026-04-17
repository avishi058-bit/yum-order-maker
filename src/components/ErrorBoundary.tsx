import { Component, ErrorInfo, ReactNode } from "react";

/**
 * Global error boundary — catches render errors anywhere in the tree
 * and shows a friendly Hebrew fallback instead of a blank white screen.
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Real errors only — useful for production monitoring
    console.error("App crashed:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-background p-6"
      >
        <div className="max-w-md w-full text-center space-y-5">
          <div className="text-6xl">😕</div>
          <h1 className="text-2xl font-black text-foreground">
            משהו השתבש
          </h1>
          <p className="text-muted-foreground">
            אירעה תקלה לא צפויה. אנחנו כבר על זה — נסה לרענן את הדף.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            רענון הדף
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
