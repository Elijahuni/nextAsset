import ApprovalsView from '@/components/approvals/ApprovalsView'
import { ErrorBoundary } from '@/components/ui'

export default function ApprovalsPage() {
  return (
    <ErrorBoundary section="결재 문서함">
      <ApprovalsView />
    </ErrorBoundary>
  )
}
