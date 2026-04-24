interface EmptyStateProps {
  message: string
}

/** 테이블 빈 상태 — <tbody> 안에서 사용 */
export function EmptyTableRow({ message, colSpan }: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16 text-slate-400 text-sm">
        {message}
      </td>
    </tr>
  )
}

/** 일반 컨테이너 빈 상태 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
      {message}
    </div>
  )
}
