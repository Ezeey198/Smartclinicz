import { Component } from "react";

// Shows the real error on screen instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 640, margin: "10vh auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h2>Something went wrong loading ClinicPro</h2>
        <p>Refresh the page. If it keeps happening, send this message to your developer:</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f4f7f7", padding: 14, borderRadius: 8 }}>{String(this.state.error?.stack || this.state.error)}</pre>
      </div>
    );
  }
}
