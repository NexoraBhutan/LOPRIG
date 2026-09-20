import { Component } from "react";
import { Link } from "react-router-dom";
import Mascot from "./Mascot";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[80dvh] flex items-center justify-center px-8 bg-white">
          <div className="max-w-md text-center flex flex-col items-center gap-6">
            <Mascot pose="sad" size={120} />
            <h1 className="text-2xl font-semibold text-ink-strong">Something went wrong</h1>
            <p className="text-ink-muted text-[0.95rem] leading-relaxed">
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                className="bg-gold text-ink-strong font-bold text-xs tracking-widest uppercase px-6 py-3 rounded-[4px] border-2 border-gold hover:bg-gold-dark hover:border-gold-dark transition-all cursor-pointer"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try Again
              </button>
              <Link to="/" className="bg-transparent text-ink-strong font-bold text-xs tracking-widest uppercase px-6 py-3 rounded-[4px] border-2 border-line-strong hover:border-gold transition-all no-underline">
                Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
