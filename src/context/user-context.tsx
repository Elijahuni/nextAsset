'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Role definitions — matched to DB users seeded via prisma/seed.ts
export const MOCK_USERS = [
  { id: 'admin',    name: '시스템관리자', role: 'admin'    as const, department: '경영지원부', email: 'admin@assetcop.local' },
  { id: 'manager1', name: '김팀장',      role: 'manager'  as const, department: 'IT개발팀',  email: 'manager1@assetcop.local' },
  { id: 'emp1',     name: '홍길동',      role: 'employee' as const, department: '경영지원부', email: 'emp1@assetcop.local' },
  { id: 'emp2',     name: '김철수',      role: 'employee' as const, department: 'IT개발팀',  email: 'emp2@assetcop.local' },
]

export type UserRole = 'admin' | 'manager' | 'employee'
export interface AppUser {
  id: string
  name: string
  role: UserRole
  department: string
  email: string
}

interface UserContextValue {
  currentUser: AppUser
  isLoggedIn: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  // Dev helper: switch role without re-login (remove for production)
  handleUserChange: (userId: string) => void
  canManageSystem: boolean
  canManageAssets: boolean
  isEmployee: boolean
}

const UserContext = createContext<UserContextValue | null>(null)

const DEFAULT_USER = MOCK_USERS[0]

function resolveUser(email: string | undefined): AppUser | null {
  if (!email) return null
  return MOCK_USERS.find((u) => u.email === email) ?? null
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser>(DEFAULT_USER)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = resolveUser(session.user.email)
        if (user) { setCurrentUser(user); setIsLoggedIn(true) }
      }
      setIsLoading(false)
    })

    // Keep in sync with token refresh / logout in other tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = resolveUser(session.user.email)
        if (user) { setCurrentUser(user); setIsLoggedIn(true) }
      } else {
        setCurrentUser(DEFAULT_USER)
        setIsLoggedIn(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: `[Supabase] ${error.message}` }
    const user = resolveUser(email)
    if (!user) return { error: '등록된 사용자 계정이 없습니다.' }
    setCurrentUser(user)
    setIsLoggedIn(true)
    router.refresh()   // 서버 컴포넌트에 새 세션 쿠키 전파
    router.push('/')
    return {}
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setIsLoggedIn(false)
    setCurrentUser(DEFAULT_USER)
    router.push('/login')
  }

  // Dev-only: quick role switch without re-login
  const handleUserChange = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (user) setCurrentUser(user)
  }

  const canManageSystem = currentUser.role === 'admin'
  const canManageAssets = currentUser.role === 'admin' || currentUser.role === 'manager'
  const isEmployee = currentUser.role === 'employee'

  return (
    <UserContext.Provider value={{
      currentUser, isLoggedIn, isLoading,
      login, logout, handleUserChange,
      canManageSystem, canManageAssets, isEmployee,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside UserProvider')
  return ctx
}
