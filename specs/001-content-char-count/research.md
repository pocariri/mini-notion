# Phase 0 Research: 내용 글자 수 카운터

**Feature**: `001-content-char-count` | **Date**: 2026-07-10

스펙과 clarify에서 대부분의 결정이 확정되어 미해결 NEEDS CLARIFICATION은 없다. 아래는 구현을 좌우하는 기술 결정과 대안 검토를 기록한다.

---

## D1. 글자 수 계산 방식

- **Decision**: `charCount(text) = text.length` — 자바스크립트 문자열 길이(UTF-16 코드 유닛). 공백·줄바꿈 포함.
- **Rationale**: 스펙 FR-003(공백·줄바꿈 포함)과 Assumptions에 부합. 한글 완성형 음절은 1 코드 유닛(예: "안녕하세요" = 5)이라 한국어 사용에 자연스럽다. 최단순·제로코스트(원칙 IV).
- **Alternatives considered**:
  - `Intl.Segmenter`(grapheme 단위) — 이모지·조합형을 1로 세지만, 스펙 범위 밖이고 복잡도·번들 부담 증가. YAGNI로 기각.
  - `[...text].length`(코드 포인트) — 서로게이트 페어를 1로 세지만 결합 문자(ZWJ 이모지 등)엔 여전히 부정확. 이득 대비 불필요. 기각.
  - 공백 제외/단어 수 — 사용자 의도("글자 수")와 불일치. 기각.
- **문서화된 한계**: `"👍".length === 2` 처럼 이모지는 코드 유닛 수로 세어질 수 있음(spec Edge Cases에 명시). 테스트로 이 동작을 고정한다.

## D2. 표시 형식

- **Decision**: `<숫자>자` (예: `128자`). 숫자는 `charCount` 결과, "자"는 접미사.
- **Rationale**: clarify Q2 = A. 한국어 UI 관례에 맞고 단위가 명확. 별도 레이블 불필요.
- **구현**: 컴포넌트 JSX에서 `{charCount(post.content)}자`로 렌더(기존 `.counter`가 `#{len}/{max}`를 인라인 렌더하는 방식과 동일한 패턴, `app/me/page.tsx`). 순수 숫자 계산만 함수로 분리해 테스트한다.

## D3. 배치 · 항상 보이기 (sticky)

- **Decision**: `.content-counter`를 `.detail-inner` 내부(`.content-input` 뒤)에 두고 `position: sticky; bottom: 16px; margin-left: auto; width: fit-content`로 스타일링.
- **Rationale**: clarify Q1 = A(편집 영역 우측 하단 고정, 스크롤해도 항상 보임).
  - `.detail`이 스크롤 컨테이너(`overflow-y: auto`)이므로, 그 후손 요소의 `position: sticky`는 `.detail` 스크롤포트를 기준으로 붙는다 → 긴 글을 스크롤해도 하단에 고정.
  - `.detail-inner`(max-width 760px, 가운데 정렬) 안에 두고 `margin-left: auto`로 우측 정렬하면 카운터가 **콘텐츠 열의 우측 하단**에 시각적으로 묶인다.
  - 내용이 짧아 스크롤이 없으면 자연 위치(내용 끝 우측)에 표시 — 여전히 보임.
- **Alternatives considered**:
  - 뷰포트 기준 `position: fixed` 우측 하단(Q1 옵션 B) — 3-pane(레일·목록) 위에 떠서 편집 영역과 분리됨. clarify에서 기각됨.
  - 정적 배치(Q1 옵션 C) — 긴 글에서 스크롤해야 보임. 실시간 확인 가치(SC-001/003) 저하. 기각.
  - `.detail`의 직접 자식(sibling of `.detail-inner`)으로 두기 — sticky는 동작하나 우측 끝이 콘텐츠 열이 아닌 pane 가장자리에 붙어 시각적 정렬이 느슨. `.detail-inner` 내부 배치를 선택.

## D4. 스타일 토큰 (디자인 시스템 준수)

- **Decision**: 신규 토큰 없이 기존 토큰만 사용.
  - 타이포: `--font-mono`, `--text-2xs`(12px), `--text-tertiary`(#90908a) — 기존 `.counter`/`.navitem .count` 카운터 관례와 동일.
  - 표면/보더/라운드/그림자: `--surface-card`, `--border-subtle`, `--radius-pill`, `--shadow-xs` — 스크롤 시 내용 위에 떠도 읽히도록 옅은 pill 배경.
- **Rationale**: 원칙 I(NON-NEGOTIABLE). `DESIGN.md` §3 토큰·§5.12 `.counter` 선례 확인. pill+옅은 배경은 위스퍼 섀도우/헤어라인 원칙과 일관.
- **Sync**: 새 컴포넌트 클래스이므로 `DESIGN.md` §5.8(Detail/editor) 해부에 `.content-counter`를 추가한다(같은 작업 내).

## D5. 테스트 전략 (TDD)

- **Decision**: 두 계층으로 실패 테스트 선작성.
  1. **단위** — `lib/format.test.ts`에 `charCount`: 빈 문자열=0, "안녕하세요"=5, 공백·줄바꿈 포함, 이모지 코드유닛(`"👍".length===2`) 고정.
  2. **컴포넌트/통합** — `components/Editor.test.tsx`(신규): (a) 빈 내용→`0자`, (b) 내용 "안녕하세요"→`5자`, (c) 제목 변경은 카운트 불변(내용만 반영), (d) **실시간 갱신** — content 상태를 보유하는 소형 테스트 하네스로 Editor를 감싸 `userEvent.type` 후 카운트 증가 확인, (e) 휴지통(readOnly) post도 카운트 표시.
- **Rationale**: 원칙 VI. 실제 동작(목 없이)로 검증. 실시간 갱신은 컴포넌트 경계에서 실제 재렌더로 확인.
- **주의**: jsdom은 `scrollHeight`를 0으로 반환 → 기존 auto-grow `useEffect`는 오류 없이 통과(테스트 영향 없음). `vitest.setup.ts`가 in-memory Storage를 제공하지만 이 테스트는 store 없이 Editor를 직접 렌더하므로 무관.

---

## 결론

모든 기술 결정 확정, 미해결 항목 없음. 신규 의존성·저장소 변경·토큰 추가 없음. Phase 1(설계·계약) 진행 가능.
