"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 역할 매핑: DB enum (ADMIN/MANAGER/STAFF) ↔ 클라이언트 식별자 (admin/manager/employee)
export type UserRole = "admin" | "manager" | "employee";

const DB_ROLE_TO_CLIENT: Record<string, UserRole> = {
  ADMIN:   "admin",
  MANAGER: "manager",
  STAFF:   "employee",
};

export interface AppUser {
  id:         string;
  name:       string;
  role:       UserRole;
  department: string;
  email:      string;
}

interface UserContextValue {
  currentUser: AppUser;
  isLoggedIn:  boolean;
  isLoading:   boolean;
  login:       (email: string, password: string) => Promise<{ error?: string }>;
  logout:      () => Promise<void>;
  canManageSystem: boolean;
  canManageAssets: boolean;
  isEmployee:      boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

// 비로그인 상태 placeholder — layout.tsx의 인증 가드가 실제 콘텐츠를 막아주므로 안전
// (컴포넌트들이 currentUser.xxx를 non-null로 가정하는 기존 코드 호환)
const GUEST_USER: AppUser = {
  id:         '',
  name:       '',
  email:      '',
  role:       'employee',
  department: '',
};

/** /api/auth/me 응답을 클라이언트 사용자 형태로 변환 */
async function fetchCurrentUser(): Promise<AppUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const role = DB_ROLE_TO_CLIENT[data.role];
    if (!role) return null; // 알 수 없는 역할은 거부
    return {
      id:         data.id,
      name:       data.name,
      email:      data.email,
      role,
      department: data.department,
    };
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser>(GUEST_USER);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const router = useRouter();

  /** Supabase 세션 + DB 사용자 정보를 동기화 */
  const syncSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setCurrentUser(GUEST_USER);
      setIsLoggedIn(false);
      return;
    }
    const user = await fetchCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    } else {
      // Supabase 세션은 있지만 DB users에 매칭되는 레코드가 없음 → 강제 로그아웃
      await supabase.auth.signOut();
      setCurrentUser(GUEST_USER);
      setIsLoggedIn(false);
    }
  };

  useEffect(() => {
    syncSession().finally(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      syncSession();
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: `[Supabase] ${error.message}` };

    const user = await fetchCurrentUser();
    if (!user) {
      await supabase.auth.signOut();
      return { error: "DB에 등록된 사용자 정보가 없습니다. 관리자에게 문의하세요." };
    }
    setCurrentUser(user);
    setIsLoggedIn(true);
    router.refresh(); // 서버 컴포넌트에 새 세션 쿠키 전파
    router.push("/");
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(GUEST_USER);
    setIsLoggedIn(false);
    router.push("/login");
  };

  // 권한 플래그는 isLoggedIn과 함께 평가 — 비로그인 GUEST는 항상 false
  const canManageSystem = isLoggedIn && currentUser.role === "admin";
  const canManageAssets = isLoggedIn && (currentUser.role === "admin" || currentUser.role === "manager");
  const isEmployee      = isLoggedIn && currentUser.role === "employee";

  return (
    <UserContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        isLoading,
        login,
        logout,
        canManageSystem,
        canManageAssets,
        isEmployee,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
