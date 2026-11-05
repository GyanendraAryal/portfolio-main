import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
          <h1 className="text-2xl font-bold text-orange-500">Something went wrong</h1>
          <p className="text-slate-400">Please refresh the page to try again.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-xl text-sm font-medium transition"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
