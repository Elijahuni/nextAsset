import AssetLedger from '@/components/assets/AssetLedger'
import { ErrorBoundary } from '@/components/ui'

export default function AssetsPage() {
  return (
    <ErrorBoundary section="자산 원장">
      <AssetLedger />
    </ErrorBoundary>
  )
}
