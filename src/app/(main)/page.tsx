import Dashboard from '@/components/dashboard/Dashboard'
import { ErrorBoundary } from '@/components/ui'

export default function HomePage() {
  return (
    <ErrorBoundary section="대시보드">
      <Dashboard />
    </ErrorBoundary>
  )
}
