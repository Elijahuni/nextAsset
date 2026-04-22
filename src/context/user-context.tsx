'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'asset_user_id'

// 원본 MOCK_USERS 유지
export const MOCK_USERS = [
  { id: 'admin',    name: '시스템관리자', role: 'admin'    as const, department: '경영지원부' },
  { id: 'manager1', name: '김팀장',      role: 'manager'  as const, department: 'IT개발팀'  },
  { id: 'emp1',     name: '홍길동',      role: 'employee' as const, department: '경영지원부' },
  { id: 'emp2',     name: '김철수',      role: 'employee' as const, department: 'IT개발팀'  },
]

export type UserRole = 'admin' | 'manager' | 'employee'
export interface AppUser {
  id: string
  name: string
  role: UserRole
  department: string
}

interface UserContextValue {
  currentUser: AppUser
  isLoggedIn: boolean
  handleUserChange: (userId: string) => void
  login: (userId: string) => void
  logout: () => void
  canManageSystem: boolean
  canManageAssets: boolean
  isEmployee: boolean
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser>(MOCK_USERS[0])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()

  // 마운트 시 localStorage에서 로그인 상태 복원
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      const user = MOCK_USERS.find((u) => u.id === savedId)
      if (user) {
        setCurrentUser(user)
        setIsLoggedIn(true)
      }
    }
  }, [])

  const login = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (!user) return
    localStorage.setItem(STORAGE_KEY, userId)
    setCurrentUser(user)
    setIsLoggedIn(true)
    router.push('/')
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setIsLoggedIn(false)
    setCurrentUser(MOCK_USERS[0])
    router.push('/login')
  }

  const handleUserChange = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (user) setCurrentUser(user)
  }

  const canManageSystem = currentUser.role === 'admin'
  const canManageAssets = currentUser.role === 'admin' || currentUser.role === 'manager'
  const isEmployee = currentUser.role === 'employee'

  return (
    <UserContext.Provider value={{
      currentUser, isLoggedIn,
      handleUserChange, login, logout,
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
