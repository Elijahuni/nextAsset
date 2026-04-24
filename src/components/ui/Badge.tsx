import { type ReactNode } from 'react'

interface BadgeProps {
  /** Tailwind 색상 클래스 — 예) 'bg-blue-100 text-blue-800 border-blue-200' */
  colorClass: string
  label: string
  icon?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * 범용 상태 뱃지 컴포넌트
 * - 자산 상태, 결재 상태 등 다양한 뱃지에 재사용
 * - colorClass는 호출부에서 STATUS_COLOR 맵을 통해 전달
 */
export function Badge({ colorClass, label, icon, size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm'
    ? 'px-2.5 py-1 text-[11px]'
    : 'px-3 py-1.5 text-xs'

  return (
    <span className={`inline-flex items-center font-bold rounded-md border ${sizeClass} ${colorClass}`}>
      {icon}
      {label}
    </span>
  )
}
