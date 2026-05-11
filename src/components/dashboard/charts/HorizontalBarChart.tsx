'use client'

import { useState } from 'react'

interface DeptBar {
  dept:       string
  totalValue: number
  percentage: number
}

interface HorizontalBarChartProps {
  data: DeptBar[]
}

// 금액 축약 (억/만 단위)
function compactCurrency(val: number): string {
  if (val >= 1_0000_0000) return `${(val / 1_0000_0000).toFixed(1)}억`
  if (val >= 1_0000)      return `${Math.round(val / 1_0000)}만`
  return val.toLocaleString()
}

const BAR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
]

// viewBox 상수
const VW      = 480
const ROW_H   = 34
const LABEL_W = 100   // 부서명 영역 너비
const BAR_MAX = 280   // 바 최대 픽셀 너비
const PAD_T   = 8
const PAD_B   = 8

export default function HorizontalBarChart({ data }: HorizontalBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (data.length === 0) return null

  const VH = PAD_T + data.length * ROW_H + PAD_B

  return (
    <div className="w-full" aria-label="부서별 자산 금액 수평 바 차트" role="img">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        onMouseLeave={() => setHovered(null)}
      >
        {data.map((row, i) => {
          const y       = PAD_T + i * ROW_H
          const barW    = (row.percentage / 100) * BAR_MAX
          const isHov   = hovered === row.dept
          const color   = BAR_COLORS[i % BAR_COLORS.length]
          const valX    = LABEL_W + barW + 8
          const labelTruncated = row.dept.length > 8 ? row.dept.slice(0, 7) + '…' : row.dept

          return (
            <g
              key={row.dept}
              onMouseEnter={() => setHovered(row.dept)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-default"
            >
              {/* 배경 하이라이트 */}
              {isHov && (
                <rect
                  x={0} y={y} width={VW} height={ROW_H - 4}
                  rx="6" fill="currentColor"
                  className="text-slate-100 dark:text-slate-700/60"
                />
              )}

              {/* 부서명 */}
              <text
                x={LABEL_W - 8} y={y + ROW_H / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight={isHov ? '700' : '500'}
                className={isHov
                  ? 'fill-slate-900 dark:fill-slate-100'
                  : 'fill-slate-600 dark:fill-slate-400'}
              >
                {labelTruncated}
              </text>

              {/* 트랙 */}
              <rect
                x={LABEL_W} y={y + 8} width={BAR_MAX} height={ROW_H - 18}
                rx="4" fill="currentColor"
                className="text-slate-100 dark:text-slate-700"
              />

              {/* 바 */}
              <rect
                x={LABEL_W} y={y + 8}
                width={Math.max(barW, 4)}
                height={ROW_H - 18}
                rx="4"
                fill={color}
                opacity={isHov ? 1 : 0.82}
                style={{ transition: 'width 0.4s cubic-bezier(.4,0,.2,1), opacity 0.2s' }}
              />

              {/* 금액 레이블 */}
              <text
                x={valX > LABEL_W + BAR_MAX - 40 ? LABEL_W + BAR_MAX + 6 : valX}
                y={y + ROW_H / 2 + 1}
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="600"
                fill={isHov ? color : '#94A3B8'}
              >
                {compactCurrency(row.totalValue)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 순위 표 (값 확인용) */}
      <ol className="mt-1 space-y-0.5">
        {data.map((row, i) => (
          <li
            key={row.dept}
            onMouseEnter={() => setHovered(row.dept)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg transition-colors cursor-default ${
              hovered === row.dept ? 'bg-slate-100 dark:bg-slate-700/50' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
              />
              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                {row.dept}
              </span>
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {row.totalValue.toLocaleString()}원
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
