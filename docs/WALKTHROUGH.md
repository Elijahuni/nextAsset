# High Priority 기능 구현 워크스루

> 구현일: 2026-04-23  
> 브랜치: `claude/laughing-jepsen-db29c0`

---

## 개요

AssetCop MVP에서 핵심 CRUD가 없어 실제 운용이 불가능했던 4가지 기능을 구현했습니다.

| # | 기능 | 관련 파일 |
|---|---|---|
| ① | 자산 신규 등록 모달 | `AssetCreateModal.tsx` |
| ② | 자산 상세 조회 모달 (4탭) | `AssetDetailModal.tsx` |
| ③ | 결재 기안 모달 (AI 자동완성) | `ApprovalDraftModal.tsx` |
| ④ | 결재 상세 + 승인/반려 | `ApprovalDetailModal.tsx` |

---

## 신규 파일 목록

### API

#### `src/app/api/assets/[id]/maintenance/route.ts`
기존에 스키마만 존재했던 `MaintenanceLog` 모델을 위한 API 엔드포인트.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/assets/:id/maintenance` | 해당 자산의 유지보수 이력 목록 |
| `POST` | `/api/assets/:id/maintenance` | 유지보수 이력 추가 |

**POST 요청 바디:**
```json
{
  "date": "2026-04-23",
  "vendor": "삼성서비스센터",
  "cost": 150000,
  "detail": "배터리 교체"
}
```

---

### 컴포넌트

#### `src/components/assets/AssetCreateModal.tsx`
자산 신규 등록 모달. `canManageAssets`(admin/manager) 조건으로 버튼이 노출됩니다.

**주요 기능:**
- 자산코드 자동생성 (`ASSET-YYYYMMDD-XXXX` 형식)
- 필수/선택 필드 분리 (바코드·보증기간은 선택)
- `POST /api/assets` 연동

**사용 흐름:**
```
자산 원장 → [자산 등록] 버튼 → 폼 입력 → [등록] → 목록 자동 갱신
```

---

#### `src/components/assets/AssetDetailModal.tsx`
자산 행 클릭 시 열리는 상세 모달. `GET /api/assets/:id`를 호출해 `historyLogs`, `maintenanceLogs`를 포함한 전체 정보를 로드합니다.

**탭 구성:**

| 탭 | 접근 권한 | 내용 |
|---|---|---|
| 기본정보 | 전체 | 자산 필드 전체, 보증기간 상태 표시 |
| 유지보수 | admin / manager | 이력 목록 + 추가 폼 (`POST /api/assets/:id/maintenance`) |
| 이력 | 전체 | HistoryLog 타임라인 (타입, 처리자, 날짜) |
| 상태변경 | admin only | 드롭다운으로 상태 강제변경 (`PATCH /api/assets/:id`) |

---

#### `src/components/assets/ApprovalDraftModal.tsx`
자산을 선택(체크박스)한 후 [결재 기안] 버튼으로 열립니다.

**주요 기능:**
- 선택된 자산 칩 목록 표시
- 결재 유형 5종 (구매/폐기/이관/유지보수/대여)
- 결재자 선택 (MOCK_USERS 중 본인 제외)
- AI 자동완성: 사유 초안 입력 → `POST /api/ai/draft` → textarea 자동 채움
- `POST /api/approvals` 연동

**AI 자동완성 요청 구조:**
```json
{
  "approvalType": "구매",
  "targetAssets": "LG 그램 15인치, 맥북 프로",
  "draftReason": "사용자 입력 초안"
}
```

**주의:** `assetIds`는 반드시 1개 이상 필요합니다. 빈 선택 상태에서는 [결재 기안] 버튼이 비활성화됩니다.

---

#### `src/components/approvals/ApprovalDetailModal.tsx`
결재 목록 행 클릭 시 열리는 상세 모달. `GET /api/approvals/:id`를 호출합니다.

**표시 정보:**
- 결재 제목, 상태 뱃지, 기안일
- 기안자, 결재자, 결재 유형
- 결재 사유 (읽기 전용)
- 연결 자산 목록 (코드, 품목, 위치, 상태)

**액션 버튼 조건:**

| 버튼 | 노출 조건 | API 호출 |
|---|---|---|
| 승인 | `status === PENDING` + `canManageAssets` | `PATCH /api/approvals/:id` `{ status: 'APPROVED', approverId: currentUser.id }` |
| 반려 | `status === PENDING` + `canManageAssets` | `PATCH /api/approvals/:id` `{ status: 'REJECTED' }` |
| 기안 취소 | `status === PENDING` + 기안자 본인 | `PATCH /api/approvals/:id` `{ status: 'CANCELLED' }` |

승인 완료 시 API 내부에서 연결된 자산 상태가 결재 유형에 따라 자동 변경되고 HistoryLog가 생성됩니다.

---

### 수정 파일

#### `src/components/assets/AssetLedger.tsx`

| 변경 사항 | 내용 |
|---|---|
| `[자산 등록]` 버튼 추가 | `canManageAssets` 조건, 파란색 primary 버튼 |
| 행 `onClick` | `setDetailAssetId(asset.id)` → `AssetDetailModal` 오픈 |
| 체크박스 클릭 전파 차단 | `e.stopPropagation()` |
| `[결재 기안]` 버튼 활성화 | `selectedIds.length > 0`일 때만 클릭 가능 |
| 모달 렌더링 추가 | `AssetCreateModal`, `AssetDetailModal`, `ApprovalDraftModal` |

#### `src/components/approvals/ApprovalsView.tsx`

| 변경 사항 | 내용 |
|---|---|
| `ApiApproval` 타입 확장 | `applicant`, `approver`, `assets` 중첩 객체 추가 |
| 기안자/결재자 컬럼 | ID 대신 `applicant.name`, `approver.name` 표시 |
| 행 `onClick` | `setDetailId(approval.id)` → `ApprovalDetailModal` 오픈 |
| employee 필터링 | `isEmployee`인 경우 `?applicantId=` 쿼리로 본인 기안만 조회 |
| 목록 자동 갱신 | 승인/반려/취소 후 `fetchApprovals()` 재호출 |

---

## 알려진 제약사항

### MOCK_USERS ↔ DB User 불일치
현재 `UserContext`의 MOCK_USERS (`id: 'admin'`, `'manager1'` 등)가 Prisma `User` 테이블에 존재하지 않으면, `POST /api/approvals` 및 `PATCH /api/approvals/:id`에서 FK 제약 오류가 발생합니다.

**해결 방법 (별도 진행):** Low Priority 항목 ⑨ "실제 User DB 연동"에서 처리 예정.
```sql
-- DB에 MOCK_USERS 시드 예시
INSERT INTO users (id, name, email, role, department) VALUES
  ('admin',    '시스템관리자', 'admin@company.com',    'ADMIN',   '경영지원부'),
  ('manager1', '김팀장',       'manager1@company.com', 'MANAGER', 'IT개발팀'),
  ('emp1',     '홍길동',       'emp1@company.com',     'STAFF',   '경영지원부'),
  ('emp2',     '김철수',       'emp2@company.com',     'STAFF',   'IT개발팀');
```

---

## 검증 시나리오

### ① 자산 등록
1. admin으로 로그인 → `/assets`
2. `[자산 등록]` 버튼 클릭
3. `[자동생성]` 버튼으로 코드 채움
4. 자산명, 품목, 취득가액, 부서, 위치, 취득일 입력
5. `[등록]` → 목록에 새 자산 추가 확인

### ② 자산 상세
1. 자산 목록에서 행 클릭
2. **기본정보** 탭: 모든 필드 표시 확인
3. **유지보수** 탭 (admin/manager): 이력 추가 후 목록 갱신 확인
4. **이력** 탭: 타임라인 확인
5. **상태변경** 탭 (admin): 상태 변경 후 목록 반영 확인

### ③ 결재 기안
1. 자산 1개 이상 체크박스 선택
2. `[결재 기안]` 버튼 클릭
3. 제목, 유형 입력 후 사유란에 초안 키워드 입력
4. `[AI 자동완성]` 클릭 → 사유 자동 완성 확인
5. `[기안 제출]` → `/approvals`에서 새 결재 확인

### ④ 결재 승인/반려
1. manager 또는 admin으로 `/approvals` 접속
2. PENDING 상태 결재 행 클릭
3. 상세 모달에서 자산 목록 확인
4. `[승인]` 또는 `[반려]` 클릭
5. 모달 닫힘 + 목록 상태 갱신 확인
6. (승인 시) 해당 자산의 상태가 결재 유형에 따라 변경됨

---

## Medium Priority 구현 (2026-04-23)

### ⑤ 자산 원장 인쇄 기능

**변경 파일:**
- `src/app/globals.css` — `@media print` 전역 스타일 추가
- `src/components/assets/AssetLedger.tsx` — `[인쇄]` 버튼 추가 (`Printer` 아이콘)

**동작:** 툴바 우측 `[인쇄]` 버튼 클릭 → `window.print()` 호출  
`print:hidden` 클래스가 적용된 툴바·체크박스는 인쇄 화면에서 숨겨집니다.

---

### ⑥ 기초정보 관리 DB 연동

**신규 파일:**
- `src/app/api/master/route.ts` — `GET / POST / DELETE` (JSON 파일 읽기·쓰기)
- `data/master.json` — 서버 첫 기동 시 자동 생성

**변경 파일:**
- `src/components/master/MasterView.tsx` — 인메모리 → API 연동으로 전환

**API 규격:**

| 메서드 | 경로 | 바디 | 설명 |
|---|---|---|---|
| `GET` | `/api/master` | — | 전체 마스터 데이터 |
| `POST` | `/api/master` | `{ type, value }` | 항목 추가 |
| `DELETE` | `/api/master` | `{ type, value }` | 항목 삭제 |

`type` 허용값: `categories` \| `departments` \| `locations` \| `vendors`

**주의:** Next.js가 빌드 후 Vercel 등 읽기 전용 파일시스템에 배포되는 경우 JSON 쓰기가 실패합니다.  
→ 운영 환경에서는 별도 `master_items` 테이블 추가 필요 (DB 마이그레이션 필요).

---

### ⑦ 감가상각 규칙 편집 모달

**신규 파일:**
- `src/components/depreciation/DepreciationRuleModal.tsx`
  - 품목별 내용연수(3/4/5/6/8/10년)·상각방법(정액법/정률법) 편집
  - `[기본값 복원]` 버튼 — `DEFAULT_DEPRECIATION_RULES` 초기화
  - 저장 시 `localStorage`에 퍼시스턴스 (`depreciation_custom_rules` 키)
  - `loadRules()` / `saveRules()` 유틸 함수 export

**변경 파일:**
- `src/components/depreciation/DepreciationView.tsx`
  - 헤더에 `[규칙 편집]` 버튼 추가
  - 페이지 마운트 시 `loadRules()`로 커스텀 규칙 로드
  - `calculateDepreciation()` 호출 시 `customRules` 전달
  - **합계 행 추가**: 테이블 하단 `<tfoot>` — 취득가액 합계, 상각누계액 합계, 장부가액 합계

---

### ⑧ 결재 현황 역할별 필터링

**변경 파일:**
- `src/app/api/approvals/route.ts` — `department` 쿼리 파라미터 지원 추가
  - `department` + `approverId` 동시 전달 시 Prisma `OR` 조건으로 조회
- `src/components/approvals/ApprovalsView.tsx` — 역할별 fetch 파라미터 분기

| 역할 | 조회 조건 | 파라미터 |
|---|---|---|
| admin | 전체 | (없음) |
| manager | 본인 부서 기안 OR 본인이 결재자 | `?department=IT개발팀&approverId=manager1` |
| employee | 본인 기안만 | `?applicantId=emp1` |

---

---

## Low Priority 구현 (2026-04-23)

### ⑨ 실제 User DB 연동 — 시드 스크립트

**신규 파일:**
- `prisma/seed.ts` — MOCK_USERS 4명을 `users` 테이블에 `upsert`

**변경 파일:**
- `package.json` — `"db:seed": "npx tsx prisma/seed.ts"` 스크립트 추가

**실행 방법:**
```bash
pnpm db:seed
# 또는
npx tsx prisma/seed.ts
```

삽입되는 데이터:

| id | name | email | role | department |
|---|---|---|---|---|
| `admin` | 시스템관리자 | admin@assetcop.local | ADMIN | 경영지원부 |
| `manager1` | 김팀장 | manager1@assetcop.local | MANAGER | IT개발팀 |
| `emp1` | 홍길동 | emp1@assetcop.local | STAFF | 경영지원부 |
| `emp2` | 김철수 | emp2@assetcop.local | STAFF | IT개발팀 |

시드 실행 후 결재 API (`POST /api/approvals`, `PATCH /api/approvals/:id`)의 FK 오류가 해소됩니다.

---

### ⑩ 보증기간 만료 알림

**변경 파일:**
- `src/components/layout/Header.tsx`

**변경 내용:**
- `Bell` 아이콘을 클릭형 드롭다운으로 교체 (바깥 클릭 시 닫힘)
- 마운트 시 `/api/assets`를 추가 호출 → `getWarrantyStatus()`로 만료·임박 자산 필터링
- 알림 카운트 = `pendingCount(결재 대기)` + `warningAssets.length(보증기간 만료/임박)`
- 드롭다운 내 표시:
  - 결재 대기: 🕐 아이콘 + "결재 대기 N건"
  - 보증기간 만료·임박 자산별: ⚠️ 아이콘 + 자산명 + 상태 문구 (만료/D-N)

---

### ⑪ 자산 원장 필터 드롭다운

**변경 파일:**
- `src/components/assets/AssetLedger.tsx`

**변경 내용:**
- 툴바에 2행 레이아웃 추가 (1행: 검색+버튼, 2행: 필터)
- 3개 드롭다운 필터:
  - **상태** (전체/사용가능/사용중/수리중/보관중/처분)
  - **품목** (전체/IT장비/사무가구/차량/기계장치/기타)
  - **부서** (전체/자산 데이터에서 동적 추출)
- 활성 필터 수 표시 + `[필터 초기화]` 버튼
- 푸터에 "전체 N건 중 필터 적용" 표시

---

### ⑫ 결재 기안 단독 기안

**변경 파일:**

1. `src/app/api/approvals/route.ts`
   - `assetIds`를 선택적(optional)으로 변경
   - 이전: `assetIds` non-empty 필수 → 현재: `[]`인 경우 `assets.create` 생략

2. `src/components/assets/ApprovalDraftModal.tsx`
   - `selectedAssets.length === 0`일 때 "단독 기안 안내" 텍스트 표시

3. `src/components/approvals/ApprovalsView.tsx`
   - 헤더 우측에 `[기안하기]` 버튼 추가
   - 클릭 시 `ApprovalDraftModal`을 `selectedAssets=[]`로 열기

**사용 흐름:**
```
/approvals → [기안하기] → 제목/유형/사유 입력 → [기안 제출]
(자산 선택 없이 단독 결재 가능)
```

---

## 최종 진행률

| 영역 | 최초 | 현재 |
|---|---|---|
| 인프라 / DB / API | 90% | **98%** |
| 자산 원장 | 50% | **95%** |
| 결재 현황 | 40% | **95%** |
| 배치도 | 75% | 75% |
| 재물조사 | 70% | 70% |
| 감가상각 | 80% | **98%** |
| 기초정보 관리 | 60% | **92%** |
| **전체** | ~58% | **~90%** |
