# Contract: /me 프로필 폼 — 자기소개 필드 (`app/me/page.tsx`)

DESIGN.md §5.12(Settings)·§6.4(/me 화면) 계약의 확장. 시각 값은 전부 기존 토큰 — 신규 토큰 0개(연구 D4).

## 구조 (anatomy)

별명 `.field-block` **아래**, "연결된 계정" hint 위에 삽입:

```tsx
<div className="field-block">
  <div className="section-label" style={{ paddingLeft: 0 }}>자기소개</div>
  <label className="field field-multi">
    <textarea
      value={introduction}
      maxLength={MAX_INTRODUCTION}          // = 150
      rows={3}                              // clarify: "3줄 안팎", 초과분 내부 스크롤
      aria-label="자기소개"
      placeholder="자신을 간단히 소개해 보세요."
      onChange={(e) => setIntroduction(e.target.value)}
      disabled={profileStatus !== 'ready'}
    />
    <span className="counter">#{introduction.length}/{MAX_INTRODUCTION}</span>
  </label>
  <p className="hint">150자까지 남길 수 있어요.</p>
</div>
```

- 별명 input에도 `aria-label="별명"` 추가(연구 D7 — 시각·동작 변화 0).

## CSS (`app/globals.css` — `.field` 블록 인근에 추가)

| 셀렉터 | 선언 | 근거 |
|---|---|---|
| `.field-multi` | `flex-direction: column; align-items: stretch;` | 카운터를 아래로 — `.field`의 보더·radius·surface·transition·`:focus-within`을 그대로 상속 |
| `.field-multi .counter` | `align-self: flex-end;` | 우하단 정렬(에디터 카운터 위치 관례) |
| `.field textarea` | `border: none; outline: none; resize: none; background: transparent; padding: 0; width: 100%; font-size: var(--text-base); line-height: var(--lh-relaxed);` | `.content-input`(§5.8) 리셋 미러. **`.field input`에 병기 금지** — `--fw-semibold` 상속 방지 |
| `.field textarea::placeholder` | `color: var(--text-tertiary);` | `.content-input::placeholder` 관례 |

## 상태 계약

| 상태 | 조건 | 표시 |
|---|---|---|
| 로딩 | `!ready \|\| !user \|\| profileStatus === 'loading'` | 기존 스플래시 유지 — **폼 미하이드레이션** (연구 D2: 구글 기본값 선표시 금지) |
| 기본 | `profileStatus === 'ready'` | 폼 하이드레이션(1회). 자기소개 = `user.introduction ?? ''` |
| 포커스 | `.field:focus-within` | `--accent` 보더 + `--shadow-focus` (§7·§10 — 변형이 자동 상속) |
| 조회 실패 | `profileStatus === 'error'` | 폼 표시하되 **모든 입력·저장 비활성**(disabled) + `role="alert"` 오류 안내("프로필을 불러오지 못했어요.") + `재시도` 버튼(`btn`, `retryProfile()` 호출) — FR-019 |
| 재시도 성공 | `error → loading → ready` | 폼 정상 복귀 + DB 값으로 하이드레이션 + 저장 재개 — FR-021 |
| 저장 중 | `saving` | 버튼 "저장 중…" + disabled (기존 그대로) |
| 저장 성공 | | `.saved-note` "저장되었습니다." 2초 (기존 그대로) |
| 저장 실패 | | `.save-error` 안내, **입력값 유지** (기존 그대로 — FR-012) |

## 폼 로직 계약

| # | 규칙 |
|---|---|
| F1 | `MAX_INTRODUCTION = 150` 상수 (MAX_NICKNAME 관례) |
| F2 | `dirty = nickname !== user.nickname \|\| image !== user.image \|\| introduction !== (user.introduction ?? '')` |
| F3 | `valid`는 기존 그대로(별명만 필수) — 자기소개는 빈 값 유효 (FR-005) |
| F4 | 저장 버튼 게이트: `disabled={!dirty \|\| !valid \|\| saving \|\| profileStatus !== 'ready'}` |
| F5 | 저장 페이로드: `updateUser({ nickname: trimmed, image, introduction: introTrimmed === '' ? null : introTrimmed })` — 한 번의 호출로 전부 (FR-010) |
| F6 | 저장 성공 시 폼의 introduction을 trim 값으로 되메움(별명 :78 관례) |
| F7 | 카운터는 trim 전 원본 길이 표시(별명 관례와 동일) |

## 검증 (테스트)

`app/me/page.test.tsx` 신설 — login/page.test.tsx 스타일(routerMock + `@/lib/supabase` 목 + 실제 StoreProvider + userEvent). 지연 응답 목으로 하이드레이션 게이트(D2)를, `selectError` 목으로 실패·재시도(FR-019~021)를 구동한다.
