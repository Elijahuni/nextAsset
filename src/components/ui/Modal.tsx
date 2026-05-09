'use client'

import { type ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE_CLASS: Record<ModalSize, string> = {
  sm:    'max-w-sm',
  md:    'max-w-md',
  lg:    'max-w-lg',
  xl:    'max-w-xl',
  '2xl': 'max-w-2xl',
}

interface ModalProps {
  /** 헤더에 표시할 제목 (ReactNode로 아이콘 포함 가능) */
  title: ReactNode
  onClose: () => void
  size?: ModalSize
  /** 스크롤 가능한 본문 영역 */
  children: ReactNode
  /** border-t 포함 푸터 영역 (선택) */
  footer?: ReactNode
}

/**
 * 공통 모달 컴포넌트
 * - backdrop overlay + 카드 구조를 한 곳에서 관리
 * - 다크모드 지원 (dark: 클래스 포함)
 * - WAI-ARIA dialog 패턴 적용
 */
export function Modal({ title, onClose, size = 'xl', children, footer }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${SIZE_CLASS[size]} mx-4 flex flex-col max-h-[90vh]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >

        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div
            id="modal-title"
            className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center min-w-0"
          >
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="모달 닫기"
            className="ml-4 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {children}
        </div>

        {/* 푸터 (선택적) */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 dark:border-slate-700">
            {footer}
          </div>
        )}

      </div>
    </div>
  )
}
