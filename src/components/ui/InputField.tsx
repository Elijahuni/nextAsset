'use client'

import { forwardRef } from 'react'

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * 라벨 + 인풋 + 에러 메시지를 하나로 묶은 공통 폼 필드
 * - 기존 모달에서 반복되던 label + input 조합을 대체
 * - forwardRef 지원으로 react-hook-form 연동 가능
 */
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, required, error, className = '', ...props }, ref) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        ref={ref}
        required={required}
        className={`w-full border ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-300'} rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
)
InputField.displayName = 'InputField'
