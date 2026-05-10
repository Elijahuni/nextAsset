'use client'

import { useState } from 'react'

interface MonthPoint {
  year:  number
  month: number
  label: string
  count: number
}

interface LineChartProps {
  data: MonthPoint[]
}

// 뷰박스 크기
const VW   = 520
const VH   = 180
const PAD  = { top: 20, right: 16, bottom: 36, left: 36 }
const W    = VW - PAD.left - PAD.right   // 468
const H    = VH - PAD.top  - PAD.bottom  // 124

export default function LineChart({ data }: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null)

  if (data.length === 0) return null

  const maxVal = Math.max(...data.map((d) => d.count), 1)
  // y축 눈금: 0 ~ ceil(maxVal / 5) * 5 까지 5등분
  const yTop   = Math.ceil(maxVal / 5) * 5 || 5
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yTop / 4) * i))

  // 좌표 계산
  const px = (i: number) => PAD.left + (i / (data.length - 1)) * W
  const py = (v: number) => PAD.top  + H - (v / yTop) * H

  const points = data.map((d, i) => ({ x: px(i), y: py(d.count), ...d }))
  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ')

  // 영역 채우기 (그라데이션)
  const areaStr = [
    `${PAD.left},${PAD.top + H}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${PAD.left + W},${PAD.top + H}`,
  ].join(' ')

  const hovered = tooltip !== null ? points[tooltip.idx] : null

  return (
    <div className="relative w-full" aria-label="월별 자산 등록 추이 라인 차트" role="img">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>
          {/* 클립 마스크로 영역을 차트 경계 안에만 표시 */}
          <clipPath id="chartClip">
            <rect x={PAD.left} y={PAD.top} width={W} height={H} />
          </clipPath>
        </defs>

        {/* y축 그리드 라인 */}
        {yTicks.map((tick) => {
          const y = py(tick)
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + W} y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-slate-200 dark:text-slate-700"
                strokeDasharray={tick === 0 ? 'none' : '3 4'}
              />
              <text
                x={PAD.left - 6} y={y + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-slate-400 dark:fill-slate-500"
              >
                {tick}
              </text>
            </g>
          )
        })}

        {/* 영역 채우기 */}
        <polygon
          points={areaStr}
          fill="url(#lineAreaGrad)"
          clipPath="url(#chartClip)"
        />

        {/* 라인 */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath="url(#chartClip)"
        />

        {/* 데이터 포인트 & 인터랙션 */}
        {points.map((p, i) => (
          <g key={i}>
            {/* 히트 영역 (투명한 넓은 rect) */}
            <rect
              x={i === 0 ? p.x - 16 : (p.x + points[i - 1].x) / 2}
              y={PAD.top}
              width={
                i === 0
                  ? (points[1].x - p.x) / 2 + 16
                  : i === points.length - 1
                  ? (p.x - points[i - 1].x) / 2 + 16
                  : (points[i + 1].x - points[i - 1].x) / 2
              }
              height={H}
              fill="transparent"
              onMouseEnter={() => setTooltip({ idx: i, x: p.x, y: p.y })}
              className="cursor-crosshair"
            />
            {/* 포인트 도트 */}
            <circle
              cx={p.x} cy={p.y} r={tooltip?.idx === i ? 5 : 3}
              fill={tooltip?.idx === i ? '#3B82F6' : '#fff'}
              stroke="#3B82F6"
              strokeWidth="2"
              style={{ transition: 'r 0.15s ease' }}
            />
          </g>
        ))}

        {/* x축 레이블 (3개월 간격으로만 표시, 모바일 고려) */}
        {points.map((p, i) => {
          // 12개월: 0, 3, 6, 9, 11 표시
          const show = i === 0 || i === 3 || i === 6 || i === 9 || i === points.length - 1
          if (!show) return null
          return (
            <text
              key={i}
              x={p.x} y={VH - 6}
              textAnchor="middle"
              fontSize="10"
              className="fill-slate-400 dark:fill-slate-500"
            >
              {p.year !== new Date().getFullYear() && i === 0
                ? `${p.year % 100}'${p.label}`
                : p.label}
            </text>
          )
        })}

        {/* 호버 수직선 */}
        {hovered && (
          <line
            x1={hovered.x} y1={PAD.top}
            x2={hovered.x} y2={PAD.top + H}
            stroke="#3B82F6"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.5"
          />
        )}
      </svg>

      {/* 툴팁 */}
      {tooltip !== null && hovered && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-800 dark:bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
          style={{
            left:      `${(hovered.x / VW) * 100}%`,
            top:       `${(hovered.y / VH) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          {data[tooltip.idx].year}.{String(data[tooltip.idx].month).padStart(2, '0')}
          &nbsp;·&nbsp;
          <span className="text-blue-300">{data[tooltip.idx].count}건</span>
        </div>
      )}
    </div>
  )
}
