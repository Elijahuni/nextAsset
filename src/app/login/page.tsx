'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Shield, Users, User } from 'lucide-react'
import { MOCK_USERS, useUser } from '@/context/user-context'

const ROLE_META: Record<string, { label: string; desc: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  admin: {
    label: '시스템 최고 관리자',
    desc: '모든 자산 조회·수정, 기초정보 관리, 감가상각, 결재 승인',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-400',
    icon: <Shield className="w-6 h-6 text-blue-500" />,
  },
  manager: {
    label: '부서장 (중간관리자)',
    desc: '부서 자산 조회, 배치도 관리, 재물조사 실시, 결재 승인',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 hover:border-emerald-400',
    icon: <Users className="w-6 h-6 text-emerald-500" />,
  },
  employee: {
    label: '일반 사용자',
    desc: '내 보유 자산 조회, 결재 신청',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-400',
    icon: <User className="w-6 h-6 text-amber-500" />,
  },
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useUser()

  // 이미 로그인 상태면 대시보드로
  useEffect(() => {
    if (localStorage.getItem('asset_user_id')) {
      router.replace('/')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">AssetCop MVP</h1>
          <p className="text-slate-400 mt-2 text-sm">역할을 선택하여 로그인하세요</p>
        </div>

        {/* 유저 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOCK_USERS.map((user) => {
            const meta = ROLE_META[user.role]
            return (
              <button
                key={user.id}
                onClick={() => login(user.id)}
                className={`text-left p-5 rounded-2xl border-2 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${meta.border}`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-2.5 rounded-xl ${meta.bg} flex-shrink-0`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-black text-slate-900 text-lg">{user.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">{user.department}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{meta.desc}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          이 시스템은 데모용 MVP입니다 — 실제 비밀번호 없이 역할 기반 체험이 가능합니다.
        </p>
      </div>
    </div>
  )
}
