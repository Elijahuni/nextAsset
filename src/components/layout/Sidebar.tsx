"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Database,
  Monitor,
  FileSignature,
  BoxSelect,
  ScanLine,
  Calculator,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useUser } from "@/context/user-context";

// 경로 → activeMenu 키 매핑
const PATH_MAP: Record<string, string> = {
  "/": "dashboard",
  "/assets": "ledger",
  "/approvals": "approvals",
  "/map": "map",
  "/audit": "audit",
  "/depreciation": "depreciation",
  "/master": "master",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const activeMenu = PATH_MAP[pathname] ?? "dashboard";
  const { currentUser, canManageSystem, isEmployee } = useUser();

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/approvals?status=PENDING")
      .then((r) => r.json())
      .then((data: unknown[]) =>
        setPendingCount(Array.isArray(data) ? data.length : 0),
      )
      .catch(() => {});
  }, []);

  const navLink = (
    href: string,
    key: string,
    icon: React.ReactNode,
    label: string,
    badge?: number,
  ) => {
    const isActive = activeMenu === key;
    return (
      <Link
        href={href}
        onClick={onClose}
        className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors justify-between ${isActive ? "bg-blue-600 text-white" : "hover:bg-slate-800 hover:text-white"}`}
      >
        <div className="flex items-center">
          {icon}
          {label}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* 모바일 오버레이 배경 */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <aside
        className={`
      fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
      w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl flex-shrink-0 print:hidden
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
    `}
      >
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 bg-slate-950 border-b border-slate-800">
          <Database className="w-6 h-6 text-blue-400 mr-3" />
          <span className="text-lg font-bold text-white tracking-wide">
            TW_AMS 자산관리
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3 tracking-wider">
            {isEmployee ? "나의 자산" : "자산 관리"}
          </p>
          <nav className="space-y-1">
            {navLink(
              "/",
              "dashboard",
              <LayoutDashboard className="w-5 h-5 mr-3 opacity-80" />,
              isEmployee ? "나의 요약" : "대시보드",
            )}
            {navLink(
              "/assets",
              "ledger",
              <Monitor className="w-5 h-5 mr-3 opacity-80" />,
              isEmployee ? "내 보유 자산" : "자산 원장",
            )}
            {navLink(
              "/approvals",
              "approvals",
              <FileSignature className="w-5 h-5 mr-3 opacity-80" />,
              isEmployee ? "나의 결재 신청" : "결재 현황",
              !isEmployee ? pendingCount : undefined,
            )}
          </nav>

          {!isEmployee && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase mt-8 mb-3 tracking-wider">
                현장 및 재무 관리
              </p>
              <nav className="space-y-1">
                {navLink(
                  "/map",
                  "map",
                  <BoxSelect className="w-5 h-5 mr-3 opacity-80" />,
                  "도면/배치도 조회",
                )}
                {navLink(
                  "/audit",
                  "audit",
                  <ScanLine className="w-5 h-5 mr-3 opacity-80" />,
                  "재물조사 (실사)",
                )}
                {canManageSystem &&
                  navLink(
                    "/depreciation",
                    "depreciation",
                    <Calculator className="w-5 h-5 mr-3 opacity-80" />,
                    "감가상각 조회",
                  )}
              </nav>
            </>
          )}

          {canManageSystem && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase mt-8 mb-3 tracking-wider">
                시스템 설정
              </p>
              <nav className="space-y-1">
                {navLink(
                  "/master",
                  "master",
                  <Settings className="w-5 h-5 mr-3 opacity-80" />,
                  "기초 정보 관리",
                )}
              </nav>
            </>
          )}
        </div>

        {/* 하단 권한 표시 */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 mr-2" />
            <span>
              현재 권한:{" "}
              <strong className="text-white">
                {currentUser.role.toUpperCase()}
              </strong>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
