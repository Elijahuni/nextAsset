/** 기본 Skeleton 블록 — 원하는 크기/형태를 className으로 지정 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded ${className}`} />
  )
}
