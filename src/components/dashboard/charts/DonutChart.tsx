'use client'

import { useState } from 'react'

interface Slice {
  category:   string
  label:      string
  count:      number
  percentage: number
  color:      string
}

interface DonutChartProps {
  data:  Slice[]
  total: number
}

const R   = 70          // 반지름
const CX  = 90          // 중심 x
const CY  = 90          // 중심 y
const CIRC = 2 * Math.PI * R   // ≈ 439.82

export default function DonutChart({ data, total }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  // 각 슬라이스의 stroke-dashoffset 계산 (12시 방향 = -CIRC/4 오프셋)
  let offset = -CIRC / 4

  const slices = data.map((slice) => {
    const dash    = (slice.percentage / 100) * CIRC
    const gap     = CIRC - dash
    const startOff = offset
    offset -= dash          // 반시계 → 양수 감소 방향 (SVG 기본)
    return { ...slice, dash, gap, dashOffset: startOff }
  })

  const hoveredSlice = hovered ? data.find((d) => d.category === hovered) : null

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG 도넛 */}
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 180 180"
          className="w-[160px] h-[160px] sm:w-[180px] sm:h-[180px]"
          aria-label="카테고리별 자산 현황 도넛 차트"
          role="img"
        >
          {/* 배경 트랙 */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            className="text-slate-100 dark:text-slate-700"
          />

          {/* 데이터 슬라이스 */}
          {slices.map((s) => (
            <circle
              key={s.category}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={hovered === s.category ? 26 : 22}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={s.dashOffset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-width 0.2s ease', opacity: hovered && hovered !== s.category ? 0.45 : 1 }}
              onMouseEnter={() => setHovered(s.category)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
              aria-label={`${s.label}: ${s.count}건 (${s.percentage.toFixed(1)}%)`}
            />
          ))}

          {/* 중앙 텍스트 */}
          <text x={CX} y={CY - 10} textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 font-black" fontSize="22" fontWeight="800">
            {hoveredSlice ? hoveredSlice.count : total}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="11">
            {hoveredSlice ? hoveredSlice.label : '총 자산'}
          </text>
          <text x={CX} y={CY + 26} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="11">
            {hoveredSlice ? `${hoveredSlice.percentage.toFixed(1)}%` : '건'}
          </text>
        </svg>
      </div>

      {/* 범례 */}
      <ul className="flex-1 w-full space-y-2 min-w-0">
        {data.map((slice) => (
          <li
            key={slice.category}
            onMouseEnter={() => setHovered(slice.category)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg cursor-default transition-colors ${
              hovered === slice.category ? 'bg-slate-100 dark:bg-slate-700/60' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {slice.label}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400 w-10 text-right">
                {slice.percentage.toFixed(1)}%
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-8 text-right">
                {slice.count}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
