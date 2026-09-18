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
        <div className="error-boundary page-enter">
          <div className="container error-boundary-content">
            <Mascot pose="sad" size={120} />
            <h1>Something went wrong</h1>
            <p className="error-boundary-desc">
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            <div className="error-boundary-actions">
              <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>
                Try Again
              </button>
              <Link to="/" className="btn btn-outline">Go Home</Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

