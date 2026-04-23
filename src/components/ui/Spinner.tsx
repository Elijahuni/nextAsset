import { RefreshCcw } from 'lucide-react'

interface SpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

/** 전체 영역 중앙 로딩 스피너 */
export function Spinner({ message = '불러오는 중...', size = 'md' }: SpinnerProps) {
  const iconClass =
    size === 'sm' ? 'w-4 h-4' :
    size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCcw className={`${iconClass} animate-spin text-blue-500 mr-2`} />
      <span className="text-slate-500 text-sm">{message}</span>
    </div>
  )
}
