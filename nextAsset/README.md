# TW-AMS · 자산 관리 시스템

> **TW Asset Management System** — 중소기업을 위한 올인원 IT 자산 관리 플랫폼

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://vercel.com)

---

## 소개

TW-AMS는 회사 내 IT 자산(노트북·서버·소프트웨어 등)을 **등록 → 결재 → 유지보수 → 폐기**까지 전 생애주기에 걸쳐 통합 관리하는 웹 애플리케이션입니다.

- 직원(STAFF)은 자산 열람·결재 기안을, 관리자(MANAGER/ADMIN)는 자산 CRUD·결재 처리·보고서 출력까지 수행할 수 있습니다.
- 결재선을 최대 3단계로 구성하는 다단계 결재 워크플로우를 지원합니다.
- 모든 변경 이력이 자동 기록되어 감사(Audit)에 대비할 수 있습니다.

---

## 주요 기능

### 🗂️ 자산 관리
| 기능 | 설명 |
|------|------|
| 자산 CRUD | 등록·수정·소프트 삭제 / 카테고리·부서·위치·담당자 관리 |
| 고급 필터 | 상태·카테고리·부서·날짜 범위·가격 범위·보증 만료 임박 필터 |
| URL 동기화 | 필터 조건이 URL 쿼리파라미터에 반영돼 뒤로가기·북마크 지원 |
| QR 코드 | 자산별 QR 태그 생성 및 인쇄 |
| 파일 첨부 | Supabase Storage 연동 (presign→PUT→confirm 3단계 업로드) |
| Excel 내보내기 | 자산목록·유지보수이력·감가상각현황 3시트 xlsx 다운로드 |
| Excel 벌크 업로드 | xlsx 파일로 자산 대량 등록 |

### ✅ 결재 워크플로우
| 기능 | 설명 |
|------|------|
| 결재 유형 | 구매·폐기·이관·유지보수·대여 5가지 유형 |
| 다단계 결재 | 최대 3명 결재선 구성, 단계별 순차 승인 |
| 이관 자동 반영 | 이관 결재 승인 시 자산의 부서·위치 자동 업데이트 |
| 결재 상태 | 검토중·승인됨·반려됨·회수됨 4단계 |
| AI 기안 보조 | Gemini API 기반 결재 제목·사유 자동 완성 |

### 📊 대시보드 & 보고서
| 기능 | 설명 |
|------|------|
| 실시간 통계 | 자산 현황·만료 임박·최근 활동 요약 카드 |
| SVG 차트 | 카테고리별 도넛 차트 · 월별 추이 라인 차트 · 부서별 수평 바 차트 |
| 보고서 | 자산 원장 전수 조회 + Excel 내보내기 |

### 🔧 유지보수 & 감가상각
| 기능 | 설명 |
|------|------|
| 유지보수 이력 | 업체·비용·작업 내용 기록, 이력 자동 생성 |
| 정기점검 스케줄 | 점검 주기 설정, 다음 점검일 자동 계산 |
| 감가상각 계산 | 정액법·정률법 서버사이드 계산, 카테고리별 소계·합계 |
| 감가상각 규칙 | DB(MasterItem) 저장으로 전 사용자 동일 규칙 적용 |

### 📦 자산 실사
| 기능 | 설명 |
|------|------|
| 실사 생성·관리 | 실사 기간 설정, 항목별 확인/분실/잉여 처리 |
| QR 스캔 확인 | 카메라로 QR 스캔 → 실사 자동 체크 |
| 실사 리포트 | 확인율 % 표시 + 인쇄용 PDF 출력 |

### 🔔 알림
| 기능 | 설명 |
|------|------|
| 결재 알림 | 기안·승인·반려·취소 시 관련자에게 자동 알림 |
| 보증 만료 알림 | 매일 오전 9시(KST) Vercel Cron으로 30일 이내 만료 알림 |
| 헤더 벨 아이콘 | 30초 폴링, 미읽음 배지, 클릭 시 읽음 처리 |

---

## 기술 스택

```
Frontend      Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
Backend       Next.js API Routes (서버리스) · Prisma 6 ORM
Database      Supabase PostgreSQL
Auth          Supabase Auth (@supabase/ssr, 쿠키 세션)
Cache         Upstash Redis (통계·마스터 데이터 캐싱)
Storage       Supabase Storage (자산 첨부파일)
AI            Google Gemini API (자산 분석·기안 보조)
Deploy        Vercel (서버리스, Cron 내장)
Forms         react-hook-form + Zod
UI            lucide-react · react-hot-toast · qrcode.react
Excel         SheetJS (xlsx)
```

---

## 권한 체계 (RBAC)

| 역할 | 자산 조회 | 자산 등록·수정 | 결재 기안 | 결재 승인·반려 | 관리자 기능 |
|------|:---------:|:--------------:|:---------:|:--------------:|:-----------:|
| **ADMIN** | ✅ 전체 | ✅ | ✅ | ✅ | ✅ |
| **MANAGER** | ✅ 부서 | ✅ | ✅ | ✅ | ❌ |
| **STAFF** | ✅ 전체 열람 | ❌ | ✅ | ✅ (지정 시) | ❌ |

---

## 시작하기

### 사전 요구사항
- Node.js 18+
- Supabase 프로젝트 (PostgreSQL + Auth + Storage)
- Upstash Redis (선택)
- Google Gemini API 키 (선택)

### 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local`에 아래 값을 채워주세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Upstash Redis (선택)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Google Gemini (선택)
GEMINI_API_KEY=AIza...

# Vercel Cron 보안 (선택)
CRON_SECRET=your-random-secret
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# DB 마이그레이션 & Prisma 클라이언트 생성
npm run db:push

# (선택) 시드 데이터 삽입
npm run db:seed

# 개발 서버 실행
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

### 프로덕션 빌드

```bash
npm run build
npm start
```

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/              # API 라우트 (서버리스 함수)
│   │   ├── assets/       # 자산 CRUD + 벌크 + 유지보수 + 실사
│   │   ├── approvals/    # 결재 목록·상세·처리
│   │   ├── depreciation/ # 감가상각 계산
│   │   ├── export/       # Excel 내보내기
│   │   ├── notifications/# 알림
│   │   ├── stats/        # 대시보드 통계·차트
│   │   └── cron/         # 보증 만료 크론
│   └── (pages)/          # Next.js 페이지 라우트
├── components/
│   ├── assets/           # 자산 목록·상세·등록 모달
│   ├── approvals/        # 결재 목록·상세 모달
│   ├── dashboard/        # 대시보드 카드·차트
│   ├── depreciation/     # 감가상각 뷰·규칙 모달
│   ├── audit/            # 자산 실사
│   └── ui/               # 공통 UI (Modal, Badge, Skeleton...)
├── context/              # React Context (User, Theme)
└── lib/
    ├── prisma.ts          # Prisma 클라이언트 싱글턴
    ├── rbac.ts            # 인증·권한 헬퍼 (requireRoles, getRequestUser)
    ├── api-response.ts    # API 응답 헬퍼 (ok, badRequest, notFound...)
    ├── redis.ts           # Upstash Redis 캐시 헬퍼
    └── notifications.ts   # 알림 생성 헬퍼 (fire-and-forget)
```

---

## 데이터 모델

```
User ─────────────────────────────────── 사용자 (ADMIN/MANAGER/STAFF)
Asset ────────────────────────────────── 자산 (소프트 삭제)
  ├─ HistoryLog ──────────────────────── 자산 변경 이력 (전 경로 자동 기록)
  ├─ MaintenanceLog ──────────────────── 유지보수 이력
  ├─ MaintenanceSchedule ─────────────── 정기점검 스케줄
  └─ AssetFile ───────────────────────── 첨부파일 (Supabase Storage)
Approval ─────────────────────────────── 결재 문서
  ├─ ApprovalStep ────────────────────── 다단계 결재선 (최대 3단계)
  ├─ ApprovalAsset ───────────────────── 결재 대상 자산 (N:M)
  └─ ApprovalFile ────────────────────── 결재 첨부파일
AssetAudit ───────────────────────────── 자산 실사
  └─ AssetAuditItem ──────────────────── 실사 항목 (CONFIRMED/MISSING/SURPLUS)
MasterItem ───────────────────────────── 시스템 설정 (감가상각 규칙 등)
Notification ─────────────────────────── 알림
```

---

## 보안

- **RBAC**: 모든 API 라우트에 `requireRoles` 적용, 역할 미달 시 403 반환
- **IDOR 방지**: 자산·결재·알림 조회 시 소유권·부서 검증
- **입력 검증**: Zod 스키마로 서버 사이드 검증
- **쿠키 세션**: Supabase SSR 쿠키 방식, JWT 클라이언트 저장 없음
- **Cron 보호**: `CRON_SECRET` 헤더 검증

---

## 라이선스

MIT © 2025 TW-AMS Team
