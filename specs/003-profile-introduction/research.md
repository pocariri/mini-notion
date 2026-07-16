# Research: 자기소개 (Profile Introduction)

**Date**: 2026-07-16 | **Feature**: [spec.md](./spec.md)

모든 결정은 실제 코드·문서·DB를 직접 확인한 결과다. Technical Context에 NEEDS CLARIFICATION 항목 없음.

## D1. 폼 구현 방식 — 제어형 textarea + 기존 클라이언트 저장 흐름

**Decision**: `/me` 프로필 탭에 제어형 `<textarea value={introduction} maxLength={150}>`를 별명 필드와 같은 패턴으로 추가한다. Server Actions·`useActionState`·`next/form`은 사용하지 않는다.

**Rationale**: `node_modules/next/dist/docs/` 실측(원칙 II) — Next.js 16.2.10 / React 19.2.4 고정 버전. `01-app/02-guides/forms.md`는 전부 Server Action 전제라 서버 코드가 없는 이 앱에 해당 없음. `02-guides/single-page-applications.md:7-28`이 클라이언트 전용 구성(브라우저에서 서드파티로 직접 쓰기)을 명시적으로 지원. 유일하게 이 패턴과 일치하는 문서 예제는 `02-guides/preserving-ui-state.md:156-180, 277`(useState + async 핸들러 + 제어형 textarea). v16 breaking changes(`upgrading/version-16.md`) 중 클라이언트 폼·입력에 영향 주는 항목 0건. 기존 `saving/saved/saveError` useState 3종에 대해 교체를 권하는 문서 없음.

**Alternatives considered**: Server Actions + `useActionState`(서버 코드 도입 필요 — 원칙 IV 위반, 문서상 opt-in), `next/form`(제출 시 URL 탐색용 — 설정 저장에 부적합).

## D2. 하이드레이션 경쟁 — 프로필 도착을 기다린 뒤 폼 초기화 (버그 수정 필수)

**Decision**: `/me` 폼 하이드레이션(`app/me/page.tsx:33-39`)을 "세션 준비"가 아니라 "프로필 조회 완료"에 게이트한다. 스토어가 프로필 조회 상태를 노출한다(D3).

**Rationale**: **스파이크 테스트로 재현 확인** — 폼은 `user`가 생기는 즉시(세션 기준) 한 번만 초기화되는데, `public.profile` 조회(`lib/store.tsx:171-186`)는 그 뒤에 도착한다. 결과: DB에 `name: 'DB별명'`이 있어도 입력란은 구글 기본값 `김구글`로 채워짐(실측). 이 상태에서 저장하면 DB 값이 구글 기본값으로 덮어써진다. 지금도 별명에서 재현되는 버그이며, 자기소개를 같은 경로에 얹으면 FR-008(저장값 표시)·SC-008(못 본 값 덮어쓰기 0건)을 어긴다. 수정 없이는 이 기능의 P1이 성립하지 않는다.

**Alternatives considered**: 프로필 도착 시 폼 재하이드레이션(사용자가 입력 중인 값을 밀어버림 — dirty 검사로 완화해도 경쟁 창 존재), 저장 시 서버 값과 병합(충돌 해석 규칙이 필요해져 YAGNI 위반).

## D3. 저장소 게이트웨이 확장 — profileStatus + retryProfile (FR-019~021)

**Decision**: `lib/store.tsx`에 다음을 추가·변경한다.

- `Profile`·`User` 타입에 `introduction: string | null` 추가. 조회 컬럼을 `name, image, introduction`으로 확장.
- `profileStatus: 'loading' | 'ready' | 'error'`와 `retryProfile(): void`를 Store에 노출. 조회 오류(`store.tsx:180`에서 현재 버려지는 `error`)를 상태로 반영한다.
- `updateUser`는 `profileStatus !== 'ready'`이면 upsert 없이 오류를 반환한다(방어선). 현재 구현은 `profile ?? base` 폴백으로 전체 행을 upsert하므로, 조회 실패 상태에서 저장하면 DB 행 전체가 구글 기본값으로 덮어써진다 — FR-020이 요구하는 차단 지점.
- `resetAll`의 초기화 upsert에 `introduction: null` 포함(FR-015 — 현재 코드는 자기소개를 남긴다).

**Rationale**: 현재 `profile === null`이 "로딩 중 / 행 없음 / 조회 실패" 세 가지를 겸해 FR-019(실패 시 오류 상태 + 재시도)를 표현할 신호 자체가 없다. 원칙 III(단일 저장소 게이트웨이)에 따라 이 상태는 스토어가 소유해야 하며, 페이지는 소비만 한다.

**Alternatives considered**: 페이지에서 직접 Supabase 조회(원칙 III 위반), `profileError: string | null` 단독 노출(로딩/완료 구분이 없어 D2 게이트 불가), 실패 시 자기소개 필드만 잠금(별명·이미지도 같은 폴백 경로로 덮어쓰기 위험 — clarify 세션에서 폼 전체 차단으로 확정).

## D4. CSS — `.field-multi` 변형 + 분리된 `.field textarea` 리셋, 신규 토큰 0개

**Decision**: `app/globals.css`에 (1) `.field-multi` 변형(`flex-direction: column; align-items: stretch;`, `.field-multi .counter`에 `align-self: flex-end`), (2) `.field textarea` 리셋 블록(`border:none; outline:none; resize:none; background:transparent; padding:0; width:100%; line-height:var(--lh-relaxed)`), (3) `.field textarea::placeholder { color: var(--text-tertiary) }`를 추가한다. 높이는 `rows={3}`(clarify: "3줄 안팎")로 잡고 초과분은 내부 스크롤. **신규 토큰 불필요** — 필요한 토큰 전부(`--text-base`, `--lh-relaxed`, `--radius-md`, `--border-default`, `--surface-card`, `--text-tertiary`, `--shadow-focus`, `--dur-fast`, `--ease-standard`, `--font-mono`, `--text-2xs`) `:root`에 실재함을 확인.

**Rationale**: `.field`(globals.css:1017-1036)는 단일 행 전제(`align-items:center`, 가로 flex)이고 `.field input`(:1038-1045)만 리셋하므로, textarea는 UA 기본(보더·resize 핸들·아웃라인)이 그대로 노출된다. 변형 클래스는 보더·radius·surface·transition과 **`:focus-within` 접근성 계약(§7·§10에 문서화된 유일 규칙)을 재선언 없이 상속**한다. `.field input`에 textarea를 병기하지 않는 이유: `--fw-semibold`(별명용)가 본문 성격의 자기소개에 상속되기 때문. 여러 줄 본문의 행간 선례는 `.content-input`(§5.8)의 `--lh-relaxed`. min-height 등 크기값은 기존 코드 전반이 원시 px/rows를 쓰므로 토큰화가 오히려 일탈.

**Alternatives considered**: 독립 블록 신설(`:focus-within` 계약이 두 곳으로 갈라져 드리프트 위험), `.content-input` 재사용(에디터 전용 340px min-height·비카드 표면으로 설정 화면 문맥과 불일치), 자동 성장(Editor.tsx:35-41 패턴 — clarify가 "3줄 안팎 유지"로 확정해 불채택).

## D5. 카운터·글자 수 — 기존 `.counter` 재사용, `#{n}/150`, UTF-16 길이

**Decision**: 별명과 동일하게 `<span className="counter">#{introduction.length}/150</span>`. 길이 기준은 `String.length`(= `charCount()`, lib/format.ts:1-3).

**Rationale**: FR-004가 "별명과 동일한 형식"을 요구. HTML `maxLength`도 UTF-16 코드 유닛 기준이므로 카운터와 캡이 항상 일치한다. `.counter`(globals.css:1047-1052)는 이미 범용.

**Alternatives considered**: grapheme 기준 카운트(기존 카운터들과 기준이 달라져 Assumption "기존 카운터와 같은 규칙" 위반), `.content-counter` 스타일(에디터 전용 sticky 배지 — 설정 폼 문맥 아님).

## D6. 저장 규칙 — trim 후 빈 값은 null

**Decision**: 저장 시 `introduction.trim()`; 결과가 `''`이면 `null`로 upsert(FR-006·007). 폼 상태는 `string`, 스토어·DB는 `string | null`. dirty 비교는 `introduction !== (user.introduction ?? '')`.

**Rationale**: DB 컬럼이 nullable이고 "자기소개 없음"의 정규 표현은 null(빈 문자열과 이중 표현을 만들지 않음). 별명의 trim-at-save(:71) 패턴과 일치.

**Alternatives considered**: `''` 저장(없음 상태가 null/''로 갈라져 조회·표시 분기 증가).

## D7. 접근성 — 자기소개에 명시적 이름 부여

**Decision**: textarea에 `aria-label="자기소개"`를 부여한다. 같은 결함(레이블 안에 카운터만 있어 입력이 "#3/20"으로 읽히는 문제, app/me/page.tsx:161-171)이 별명에도 있으므로 별명 input에도 `aria-label="별명"`을 같은 작업에서 추가한다(시각·동작 변화 0 — FR-018 저촉 없음).

**Rationale**: 현행 패턴을 그대로 복제하면 새 필드가 "#0/150"으로 낭독되는 결함을 물려받는다. 새로 만드는 코드가 알려진 결함을 복제하는 것은 정당화 불가.

**Alternatives considered**: `id`+`htmlFor` 재구조화(감싸는 `<label>` 구조 변경이 필요해 diff 확대 — aria-label이 최소 변경).

## D8. 테스트 전략 — 스토어 목 확장 + `/me` 페이지 테스트 신설 (TDD)

**Decision**:
- `lib/store.test.tsx`: `dbMock`에 `introduction` 필드와 `selectError` 스위치를 추가해 조회 실패 경로를 열고, upsert 페이로드에 `introduction` 포함·`profileStatus` 전이·`retryProfile` 재조회·조회 실패 중 `updateUser` 거부·`resetAll`의 introduction 초기화를 검증.
- `app/me/page.test.tsx` **신설**(현재 페이지 커버리지 0): `app/login/page.test.tsx`의 스타일(routerMock + `@/lib/supabase` 목 + 실제 StoreProvider + userEvent)을 따라 US1~3 수용 시나리오를 커버. D2의 스파이크(지연 응답 목으로 DB 값 하이드레이션 검증)를 정식 실패 테스트로 승격.

**Rationale**: 원칙 VI(TDD NON-NEEGOTIABLE). 현재 `maybeSingle` 목은 `error: null` 고정(store.test.tsx:70-78)이라 FR-019 경로를 테스트할 수 없다. 목은 Supabase 경계에만 두는 기존 방침 유지.

**Alternatives considered**: 스토어 테스트만으로 커버(하이드레이션 경쟁·폼 게이트는 페이지 레벨 동작이라 불가).

## 실측 확인 사항 (참조용)

- **DB (Supabase MCP, 읽기 전용 확인)**: `public.profile.introduction` = `text`, nullable, 실재. RLS: 본인 행 SELECT/INSERT/UPDATE(authenticated, `auth.uid() = user_id`). **스키마·정책 변경 불필요·금지**(FR-017, SC-007).
- **버전**: next 16.2.10, react 19.2.4, @supabase/supabase-js 2.110.5 (모두 고정 버전).
- **DESIGN.md 드리프트**: §5.8 이후 소스 라인 범위가 실제 CSS보다 ~73줄 유령(§5.12는 실제 980-1108인데 901-1023으로 표기). CatCover 추가 때 갱신 누락 — 이번 동기화에서 함께 교정한다(§9 동기화 대상: 483, 492-499, 506, 507, 479, 570, 572, 614, 631, 635, 688 및 라인 범위들).
