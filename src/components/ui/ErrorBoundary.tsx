'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface Props {
  children:  ReactNode
  fallback?: ReactNode  // 커스텀 폴백 UI
  section?:  string     // 오류 발생 섹션 이름 (디버깅용)
}

interface State {
  hasError: boolean
  error?:   Error
}

/**
 * React 클래스 기반 Error Boundary
 *
 * 사용법:
 * <ErrorBoundary section="Dashboard">
 *   <Dashboard />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // 운영 환경에서는 Sentry 등 외부 로깅 서비스로 전송하세요.
    console.error(`[ErrorBoundary:${this.props.section ?? 'unknown'}]`, error, info.componentStack)
  }

  private reset = () => this.setState({ hasError: false, error: undefined })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] py-12 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-4 border border-red-100 dark:border-red-800">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
          {this.props.section ? `${this.props.section} 오류` : '오류가 발생했습니다'}
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-5 max-w-xs">
          {this.state.error?.message ?? '알 수 없는 오류입니다. 잠시 후 다시 시도해 주세요.'}
        </p>
        <button
          onClick={this.reset}
          className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          다시 시도
        </button>
      </div>
    )
  }
}
